import { TRPCError } from "@trpc/server";
import {
	createFileDownloadUrl,
	createFileUploadRequest,
	deleteFile,
} from "@/modules/file/file.service";
import {
	FileAlreadyDeletedError,
	FileCreationError,
	FileNotFoundError,
	StorageRecordNotFoundError,
} from "@/modules/file/file.types";
import {
	fileAdminByIdInputSchema,
	fileAdminCreateUploadRequestInputSchema,
} from "@/modules/file/file.validators";
import { adminProcedure, router } from "../index";

function mapFileError(error: unknown): never {
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

export const fileRouter = router({
	adminCreateUploadRequest: adminProcedure
		.input(fileAdminCreateUploadRequestInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await createFileUploadRequest({
					db: ctx.db,
					input: {
						...input,
						uploaderId: ctx.session.user.id,
					},
				});
			} catch (error) {
				mapFileError(error);
			}
		}),
	adminGetDownloadUrl: adminProcedure
		.input(fileAdminByIdInputSchema)
		.query(async ({ ctx, input }) => {
			try {
				return await createFileDownloadUrl({
					db: ctx.db,
					fileId: input.fileId,
				});
			} catch (error) {
				mapFileError(error);
			}
		}),
	adminDelete: adminProcedure
		.input(fileAdminByIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await deleteFile({
					db: ctx.db,
					fileId: input.fileId,
				});
			} catch (error) {
				mapFileError(error);
			}
		}),
});
