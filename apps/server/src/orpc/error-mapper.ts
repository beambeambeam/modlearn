import { ORPCError } from "@orpc/server";
import {
	CategoryNotFoundError,
	CategorySlugConflictError,
} from "@/modules/category/category.types";
import {
	CommerceCourseEmptyError,
	CommerceCourseNotFoundError,
	CommerceCurrencyMismatchError,
	CommerceInvalidOrderItemError,
	CommerceItemAlreadyOwnedError,
	CommerceOrderNotFoundError,
	CommerceOrderStateError,
	CommercePaymentConflictError,
	CommercePriceNotFoundError,
	CommercePricingWindowNotFoundError,
	CommercePricingWindowOverlapError,
	CommercePricingWindowValidationError,
} from "@/modules/commerce/commerce.types";
import {
	CourseLessonNotFoundError,
	CourseNotFoundError,
	CourseReorderValidationError,
	InvalidClassificationInputError,
} from "@/modules/course/course.types";
import {
	FileAlreadyDeletedError,
	FileCreationError,
	FileNotFoundError,
	StorageRecordNotFoundError,
} from "@/modules/file/file.types";
import {
	LibraryAccessDeniedError,
	LibraryCourseNotFoundError,
} from "@/modules/library/library.types";
import {
	ReviewCourseNotFoundError,
	ReviewModerationValidationError,
	ReviewNotFoundError,
	ReviewOwnershipRequiredError,
} from "@/modules/review/review.types";
import {
	WatchProgressCourseLessonNotFoundError,
	WatchProgressCourseNotFoundError,
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

	if (
		error instanceof CourseNotFoundError ||
		error instanceof CourseLessonNotFoundError ||
		error instanceof LibraryCourseNotFoundError ||
		error instanceof ReviewCourseNotFoundError ||
		error instanceof ReviewNotFoundError ||
		error instanceof WatchProgressCourseNotFoundError ||
		error instanceof WatchProgressCourseLessonNotFoundError
	) {
		return new ORPCError("NOT_FOUND", {
			message: error.message,
		});
	}

	if (
		error instanceof InvalidClassificationInputError ||
		error instanceof CourseReorderValidationError ||
		error instanceof ReviewModerationValidationError ||
		error instanceof WatchProgressValidationError
	) {
		return new ORPCError("BAD_REQUEST", {
			message: error.message,
		});
	}

	const commerceError = mapCommerceDomainErrorToOrpc(error);
	if (commerceError) {
		return commerceError;
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

	if (error instanceof LibraryAccessDeniedError) {
		return new ORPCError("FORBIDDEN", {
			message: error.message,
		});
	}

	if (error instanceof ReviewOwnershipRequiredError) {
		return new ORPCError("FORBIDDEN", {
			message: error.message,
		});
	}

	return null;
}

function mapCommerceDomainErrorToOrpc(
	error: unknown
): ORPCError<string, unknown> | null {
	if (
		error instanceof CommerceCourseNotFoundError ||
		error instanceof CommerceOrderNotFoundError ||
		error instanceof CommercePricingWindowNotFoundError
	) {
		return new ORPCError("NOT_FOUND", {
			message: error.message,
		});
	}

	if (
		error instanceof CommerceItemAlreadyOwnedError ||
		error instanceof CommercePaymentConflictError ||
		error instanceof CommercePricingWindowOverlapError
	) {
		return new ORPCError("CONFLICT", {
			message: error.message,
		});
	}

	if (
		error instanceof CommercePriceNotFoundError ||
		error instanceof CommerceCurrencyMismatchError ||
		error instanceof CommerceOrderStateError ||
		error instanceof CommerceCourseEmptyError ||
		error instanceof CommerceInvalidOrderItemError ||
		error instanceof CommercePricingWindowValidationError
	) {
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
