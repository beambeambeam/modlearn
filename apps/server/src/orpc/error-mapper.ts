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
	GenreNotFoundError,
	GenreSlugConflictError,
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

export function toError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	return new Error("Non-Error throwable", {
		cause: error,
	});
}

export function mapDomainErrorToOrpc(
	error: unknown
): ORPCError<string, unknown> | null {
	if (error instanceof CategoryNotFoundError) {
		return new ORPCError("NOT_FOUND", {
			message: error.message,
		});
	}

	if (error instanceof CategorySlugConflictError) {
		return new ORPCError("CONFLICT", {
			message: error.message,
		});
	}

	if (error instanceof GenreNotFoundError) {
		return new ORPCError("NOT_FOUND", {
			message: error.message,
		});
	}

	if (error instanceof GenreSlugConflictError) {
		return new ORPCError("CONFLICT", {
			message: error.message,
		});
	}

	if (
		error instanceof ContentNotFoundError ||
		error instanceof ContentCategoryNotFoundError ||
		error instanceof ContentGenreNotFoundError
	) {
		return new ORPCError("NOT_FOUND", {
			message: error.message,
		});
	}

	if (error instanceof InvalidClassificationInputError) {
		return new ORPCError("BAD_REQUEST", {
			message: error.message,
		});
	}

	if (
		error instanceof PlaylistNotFoundError ||
		error instanceof PlaylistContentNotFoundError
	) {
		return new ORPCError("NOT_FOUND", {
			message: error.message,
		});
	}

	if (error instanceof PlaylistReorderValidationError) {
		return new ORPCError("BAD_REQUEST", {
			message: error.message,
		});
	}

	if (
		error instanceof FileNotFoundError ||
		error instanceof FileAlreadyDeletedError ||
		error instanceof StorageRecordNotFoundError
	) {
		return new ORPCError("NOT_FOUND", {
			message: error.message,
		});
	}

	if (error instanceof FileCreationError) {
		return new ORPCError("BAD_REQUEST", {
			message: error.message,
		});
	}

	if (
		error instanceof WatchProgressContentNotFoundError ||
		error instanceof WatchProgressPlaylistNotFoundError
	) {
		return new ORPCError("NOT_FOUND", {
			message: error.message,
		});
	}

	if (error instanceof WatchProgressValidationError) {
		return new ORPCError("BAD_REQUEST", {
			message: error.message,
		});
	}

	return null;
}

export function toInternalOrpcError(
	error: unknown
): ORPCError<"INTERNAL_SERVER_ERROR", unknown> {
	return new ORPCError("INTERNAL_SERVER_ERROR", {
		message: "Internal server error",
		cause: toError(error),
	});
}

export async function rpcErrorInterceptor(options: {
	next: (options?: unknown) => Promise<unknown>;
	request?: { method?: string; pathname?: string; url?: string | URL };
}): Promise<unknown> {
	try {
		return await options.next();
	} catch (error) {
		if (error instanceof ORPCError) {
			throw error;
		}

		const mapped = mapDomainErrorToOrpc(error);
		if (mapped) {
			throw mapped;
		}

		console.error("Unhandled RPC error", {
			method: options.request?.method,
			path:
				options.request?.pathname ??
				(options.request?.url ? String(options.request.url) : undefined),
			error,
		});

		throw toInternalOrpcError(error);
	}
}
