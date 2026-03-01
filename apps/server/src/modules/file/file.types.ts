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
