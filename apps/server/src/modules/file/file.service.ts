import type { DbClient } from "@modlearn/db/orm";
import { sql } from "@modlearn/db/orm";
import { file, storage } from "@modlearn/db/schema/index";
import { env } from "@modlearn/env/server";
import {
	deleteObject,
	generateDownloadUrl,
	generateUploadUrl,
} from "@/lib/storage/s3-operations";

export interface CreateFileUploadRequestInput {
	uploaderId: string;
	name: string;
	size: number;
	mimeType: string;
	extension: string;
	checksum: string;
}

export interface CreateFileUploadRequestParams {
	db: FileDbClient;
	input: CreateFileUploadRequestInput;
}

export interface CreateFileUploadRequestResult {
	fileId: string;
	storageKey: string;
	uploadUrl: string;
	expiresAt: Date;
}

export interface CreateFileDownloadUrlParams {
	db: FileDbClient;
	fileId: string;
}

export interface CreateFileDownloadUrlResult {
	storageKey: string;
	downloadUrl: string;
	expiresAt: Date;
}

export interface DeleteFileParams {
	db: FileDbClient;
	fileId: string;
}

export interface DeleteFileResult {
	fileId: string;
	storageKey: string;
	deletedAt: Date;
}

const STORAGE_PROVIDER = "s3";

export type FileDbClient = DbClient;

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
			throw new Error("Failed to create file record");
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
		throw new Error("File not found");
	}

	if (fileRow.isDeleted) {
		throw new Error("File is deleted");
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
		throw new Error("Storage record not found");
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
			throw new Error("File not found");
		}

		if (fileRow.isDeleted) {
			throw new Error("File is already deleted");
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
			throw new Error("Storage record not found");
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
