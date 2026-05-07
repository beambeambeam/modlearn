export const commonErrors = {
	UNAUTHORIZED: {
		message: "Authentication required",
	},
	FORBIDDEN: {
		message: "Admin access required",
	},
	BAD_REQUEST: {
		message: "Bad request",
	},
	NOT_FOUND: {
		message: "Not found",
	},
	CONFLICT: {
		message: "Conflict",
	},
	INTERNAL_SERVER_ERROR: {
		message: "Internal server error",
	},
} as const;

export const errorGroups = {
	unauthorized: {
		UNAUTHORIZED: commonErrors.UNAUTHORIZED,
	},
	forbidden: {
		FORBIDDEN: commonErrors.FORBIDDEN,
	},
	badRequest: {
		BAD_REQUEST: commonErrors.BAD_REQUEST,
	},
	notFound: {
		NOT_FOUND: commonErrors.NOT_FOUND,
	},
	conflict: {
		CONFLICT: commonErrors.CONFLICT,
	},
	internal: {
		INTERNAL_SERVER_ERROR: commonErrors.INTERNAL_SERVER_ERROR,
	},
	auth: {
		UNAUTHORIZED: commonErrors.UNAUTHORIZED,
		FORBIDDEN: commonErrors.FORBIDDEN,
	},
	notFoundBadRequest: {
		NOT_FOUND: commonErrors.NOT_FOUND,
		BAD_REQUEST: commonErrors.BAD_REQUEST,
	},
	notFoundConflict: {
		NOT_FOUND: commonErrors.NOT_FOUND,
		CONFLICT: commonErrors.CONFLICT,
	},
	badRequestConflict: {
		BAD_REQUEST: commonErrors.BAD_REQUEST,
		CONFLICT: commonErrors.CONFLICT,
	},
	notFoundBadRequestConflict: {
		NOT_FOUND: commonErrors.NOT_FOUND,
		BAD_REQUEST: commonErrors.BAD_REQUEST,
		CONFLICT: commonErrors.CONFLICT,
	},
	notFoundForbidden: {
		NOT_FOUND: commonErrors.NOT_FOUND,
		FORBIDDEN: commonErrors.FORBIDDEN,
	},
	notFoundBadRequestForbidden: {
		NOT_FOUND: commonErrors.NOT_FOUND,
		BAD_REQUEST: commonErrors.BAD_REQUEST,
		FORBIDDEN: commonErrors.FORBIDDEN,
	},
} as const;
