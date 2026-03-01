import { env } from "@modlearn/env/server";
import { sql } from "@/lib/db/orm";
import { file, storage } from "@/lib/db/schema/index";
import {
	deleteObject,
	generateDownloadUrl,
	generateUploadUrl,
} from "@/lib/storage/s3-operations";
import {
	type CreateFileDownloadUrlParams,
	type CreateFileDownloadUrlResult,
	type CreateFileUploadRequestParams,
	type CreateFileUploadRequestResult,
	type DeleteFileParams,
	type DeleteFileResult,
	FileAlreadyDeletedError,
	FileCreationError,
	FileNotFoundError,
	StorageRecordNotFoundError,
} from "./file.types";

const STORAGE_PROVIDER = "s3";

export function createFileUploadRequest(
	params: CreateFileUploadRequestParams
): Promise<CreateFileUploadRequestResult> {
	const { db, input } = params;

	return db.transaction(async (tx) => {
		const insertResult = await tx.execute(
			sql`
				insert into ${file} (
					${sql.identifier(file.uploaderId.name)},
					${sql.identifier(file.name.name)},
					${sql.identifier(file.size.name)},
					${sql.identifier(file.mimeType.name)},
					${sql.identifier(file.extension.name)},
					${sql.identifier(file.checksum.name)}
				) values (
					${input.uploaderId},
					${input.name},
					${input.size},
					${input.mimeType},
					${input.extension},
					${input.checksum}
				)
				returning ${file.id} as "id"
			`
		);
		const insertedFile = insertResult.rows[0] as { id: string } | undefined;

		if (!insertedFile?.id) {
			throw new FileCreationError();
		}

		const storageKey = `files/${insertedFile.id}.${input.extension}`;

		await tx.execute(
			sql`
				insert into ${storage} (
					${sql.identifier(storage.fileId.name)},
					${sql.identifier(storage.storageProvider.name)},
					${sql.identifier(storage.bucket.name)},
					${sql.identifier(storage.storageKey.name)}
				) values (
					${insertedFile.id},
					${STORAGE_PROVIDER},
					${env.S3_BUCKET_NAME},
					${storageKey}
				)
			`
		);

		const presigned = await generateUploadUrl({
			key: storageKey,
			contentType: input.mimeType,
			contentLength: input.size,
			checksum: input.checksum,
		});

		return {
			fileId: insertedFile.id,
			storageKey,
			uploadUrl: presigned.uploadUrl,
			expiresAt: presigned.expiresAt,
		};
	});
}

export async function createFileDownloadUrl(
	params: CreateFileDownloadUrlParams
): Promise<CreateFileDownloadUrlResult> {
	const { db, fileId } = params;

	const fileResult = await db.execute(
		sql`
			select
				${file.id} as "id",
				${file.isDeleted} as "isDeleted"
			from ${file}
			where ${file.id} = ${fileId}
		`
	);
	const fileRow = fileResult.rows[0] as
		| { id: string; isDeleted: boolean }
		| undefined;

	if (!fileRow) {
		throw new FileNotFoundError();
	}

	if (fileRow.isDeleted) {
		throw new FileAlreadyDeletedError();
	}

	const storageResult = await db.execute(
		sql`
			select ${storage.storageKey} as "storageKey"
			from ${storage}
			where ${storage.fileId} = ${fileId}
				and ${storage.storageProvider} = ${STORAGE_PROVIDER}
		`
	);
	const storageRow = storageResult.rows[0] as
		| { storageKey: string }
		| undefined;

	if (!storageRow) {
		throw new StorageRecordNotFoundError();
	}

	const presigned = await generateDownloadUrl({
		key: storageRow.storageKey,
	});

	return {
		storageKey: storageRow.storageKey,
		downloadUrl: presigned.downloadUrl,
		expiresAt: presigned.expiresAt,
	};
}

export function deleteFile(
	params: DeleteFileParams
): Promise<DeleteFileResult> {
	const { db, fileId } = params;

	return db.transaction(async (tx) => {
		const fileResult = await tx.execute(
			sql`
				select
					${file.id} as "id",
					${file.isDeleted} as "isDeleted"
				from ${file}
				where ${file.id} = ${fileId}
			`
		);
		const fileRow = fileResult.rows[0] as
			| { id: string; isDeleted: boolean }
			| undefined;

		if (!fileRow) {
			throw new FileNotFoundError();
		}

		if (fileRow.isDeleted) {
			throw new FileAlreadyDeletedError("File is already deleted");
		}

		const storageResult = await tx.execute(
			sql`
				select ${storage.storageKey} as "storageKey"
				from ${storage}
				where ${storage.fileId} = ${fileId}
					and ${storage.storageProvider} = ${STORAGE_PROVIDER}
			`
		);
		const storageRow = storageResult.rows[0] as
			| { storageKey: string }
			| undefined;

		if (!storageRow) {
			throw new StorageRecordNotFoundError();
		}

		await deleteObject({ key: storageRow.storageKey });

		const deletedAt = new Date();

		await tx.execute(
			sql`
				update ${file}
				set
					${sql.identifier(file.isDeleted.name)} = ${true},
					${sql.identifier(file.deletedAt.name)} = ${deletedAt}
				where ${file.id} = ${fileId}
			`
		);

		return {
			fileId,
			storageKey: storageRow.storageKey,
			deletedAt,
		};
	});
}
