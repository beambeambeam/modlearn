import type { DbClient } from "@modlearn/db/orm";
import { and, eq } from "@modlearn/db/orm";
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
		const [insertedFile] = await tx
			.insert(file)
			.values({
				uploaderId: input.uploaderId,
				name: input.name,
				size: input.size,
				mimeType: input.mimeType,
				extension: input.extension,
				checksum: input.checksum,
			})
			.returning();

		if (!insertedFile?.id) {
			throw new Error("Failed to create file record");
		}

		const storageKey = `files/${insertedFile.id}.${input.extension}`;

		await tx.insert(storage).values({
			fileId: insertedFile.id,
			storageProvider: STORAGE_PROVIDER,
			bucket: env.S3_BUCKET_NAME,
			storageKey,
		});

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

	const [fileRow] = await db
		.select({ id: file.id, isDeleted: file.isDeleted })
		.from(file)
		.where(eq(file.id, fileId));

	if (!fileRow) {
		throw new Error("File not found");
	}

	if (fileRow.isDeleted) {
		throw new Error("File is deleted");
	}

	const [storageRow] = await db
		.select({ storageKey: storage.storageKey })
		.from(storage)
		.where(
			and(
				eq(storage.fileId, fileId),
				eq(storage.storageProvider, STORAGE_PROVIDER)
			)
		);

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
		const [fileRow] = await tx
			.select({ id: file.id, isDeleted: file.isDeleted })
			.from(file)
			.where(eq(file.id, fileId));

		if (!fileRow) {
			throw new Error("File not found");
		}

		if (fileRow.isDeleted) {
			throw new Error("File is already deleted");
		}

		const [storageRow] = await tx
			.select({ storageKey: storage.storageKey })
			.from(storage)
			.where(
				and(
					eq(storage.fileId, fileId),
					eq(storage.storageProvider, STORAGE_PROVIDER)
				)
			);

		if (!storageRow) {
			throw new Error("Storage record not found");
		}

		await deleteObject({ key: storageRow.storageKey });

		const deletedAt = new Date();

		await tx
			.update(file)
			.set({ isDeleted: true, deletedAt })
			.where(eq(file.id, fileId));

		return {
			fileId,
			storageKey: storageRow.storageKey,
			deletedAt,
		};
	});
}
