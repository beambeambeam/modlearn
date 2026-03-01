import type { DbClient } from "@/lib/db/orm";

export interface CreateFileUploadRequestInput {
	uploaderId: string;
	name: string;
	size: number;
	mimeType: string;
	extension: string;
	checksum: string;
}

export type FileDbClient = DbClient;

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

export class FileNotFoundError extends Error {
	constructor(message = "File not found") {
		super(message);
		this.name = "FileNotFoundError";
	}
}

export class FileAlreadyDeletedError extends Error {
	constructor(message = "File is deleted") {
		super(message);
		this.name = "FileAlreadyDeletedError";
	}
}

export class StorageRecordNotFoundError extends Error {
	constructor(message = "Storage record not found") {
		super(message);
		this.name = "StorageRecordNotFoundError";
	}
}

export class FileCreationError extends Error {
	constructor(message = "Failed to create file record") {
		super(message);
		this.name = "FileCreationError";
	}
}
