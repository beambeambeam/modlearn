import { ORPCError } from "@orpc/server";
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
import {
	WatchProgressContentNotFoundError,
	WatchProgressPlaylistNotFoundError,
	WatchProgressValidationError,
} from "@/modules/watch-progress/watch-progress.types";

type OrpcCode =
	| "NOT_FOUND"
	| "CONFLICT"
	| "BAD_REQUEST"
	| "INTERNAL_SERVER_ERROR";

const rpcError = (code: OrpcCode, message: string): never => {
	throw new ORPCError(code, {
		message,
	});
};

export function mapCategoryError(error: unknown): never {
	if (error instanceof CategoryNotFoundError) {
		return rpcError("NOT_FOUND", error.message);
	}

	if (error instanceof CategorySlugConflictError) {
		return rpcError("CONFLICT", error.message);
	}

	throw error;
}

export function mapGenreError(error: unknown): never {
	if (error instanceof ModuleGenreNotFoundError) {
		return rpcError("NOT_FOUND", error.message);
	}

	if (error instanceof GenreSlugConflictError) {
		return rpcError("CONFLICT", error.message);
	}

	throw error;
}

export function mapServiceError(error: unknown): never {
	if (
		error instanceof ContentNotFoundError ||
		error instanceof ContentCategoryNotFoundError ||
		error instanceof ContentGenreNotFoundError
	) {
		return rpcError("NOT_FOUND", error.message);
	}

	if (error instanceof InvalidClassificationInputError) {
		return rpcError("BAD_REQUEST", error.message);
	}

	throw error;
}

export function mapPlaylistServiceError(error: unknown): never {
	if (
		error instanceof PlaylistNotFoundError ||
		error instanceof PlaylistContentNotFoundError
	) {
		return rpcError("NOT_FOUND", error.message);
	}

	if (error instanceof PlaylistReorderValidationError) {
		return rpcError("BAD_REQUEST", error.message);
	}

	throw error;
}

export function mapFileError(error: unknown): never {
	if (
		error instanceof FileNotFoundError ||
		error instanceof FileAlreadyDeletedError ||
		error instanceof StorageRecordNotFoundError
	) {
		return rpcError("NOT_FOUND", error.message);
	}

	if (error instanceof FileCreationError) {
		return rpcError("BAD_REQUEST", error.message);
	}

	throw error;
}

export function mapWatchProgressError(error: unknown): never {
	if (
		error instanceof WatchProgressContentNotFoundError ||
		error instanceof WatchProgressPlaylistNotFoundError
	) {
		return rpcError("NOT_FOUND", error.message);
	}

	if (error instanceof WatchProgressValidationError) {
		return rpcError("BAD_REQUEST", error.message);
	}

	throw error;
}
