import { TRPCError } from "@trpc/server";
import {
	CategoryNotFoundError,
	CategorySlugConflictError,
} from "@/modules/category/category.types";
import {
	CategoryNotFoundError as ContentCategoryNotFoundError,
	GenreNotFoundError as ContentGenreNotFoundError,
	ContentNotFoundError,
	InvalidClassificationInputError,
} from "@/modules/content/content.types";
import {
	FileAlreadyDeletedError,
	FileCreationError,
	FileNotFoundError,
	StorageRecordNotFoundError,
} from "@/modules/file/file.types";
import {
	GenreSlugConflictError,
	GenreNotFoundError as ModuleGenreNotFoundError,
} from "@/modules/genre/genre.types";
import {
	ContentNotFoundError as PlaylistContentNotFoundError,
	PlaylistNotFoundError,
	PlaylistReorderValidationError,
} from "@/modules/playlist/playlist.types";

export function mapCategoryError(error: unknown): never {
	if (error instanceof CategoryNotFoundError) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: error.message,
		});
	}

	if (error instanceof CategorySlugConflictError) {
		throw new TRPCError({
			code: "CONFLICT",
			message: error.message,
		});
	}

	throw error;
}

export function mapGenreError(error: unknown): never {
	if (error instanceof ModuleGenreNotFoundError) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: error.message,
		});
	}

	if (error instanceof GenreSlugConflictError) {
		throw new TRPCError({
			code: "CONFLICT",
			message: error.message,
		});
	}

	throw error;
}

export function mapServiceError(error: unknown): never {
	if (
		error instanceof ContentNotFoundError ||
		error instanceof ContentCategoryNotFoundError ||
		error instanceof ContentGenreNotFoundError
	) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: error.message,
		});
	}
	if (error instanceof InvalidClassificationInputError) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: error.message,
		});
	}

	throw error;
}

export function mapPlaylistServiceError(error: unknown): never {
	if (
		error instanceof PlaylistNotFoundError ||
		error instanceof PlaylistContentNotFoundError
	) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: error.message,
		});
	}

	if (error instanceof PlaylistReorderValidationError) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: error.message,
		});
	}

	throw error;
}

export function mapFileError(error: unknown): never {
	if (
		error instanceof FileNotFoundError ||
		error instanceof FileAlreadyDeletedError ||
		error instanceof StorageRecordNotFoundError
	) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: error.message,
		});
	}

	if (error instanceof FileCreationError) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: error.message,
		});
	}

	throw error;
}
