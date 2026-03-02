import {
	createFileDownloadUrl,
	createFileUploadRequest,
	deleteFile,
} from "@/modules/file/file.service";
import {
	fileAdminByIdInputSchema,
	fileAdminCreateUploadRequestInputSchema,
} from "@/modules/file/file.validators";
import { adminProcedure, router } from "@/orpc";
import { logAdminMutation } from "@/orpc/routers/_audit";
import { mapFileError } from "@/orpc/routers/router.utils";

export const fileRouter = router({
	adminCreateUploadRequest: adminProcedure
		.input(fileAdminCreateUploadRequestInputSchema)
		.handler(async ({ context, input }) => {
			try {
				const created = await createFileUploadRequest({
					db: context.db,
					input: {
						...input,
						uploaderId: context.session.user.id,
					},
				});
				await logAdminMutation({
					context,
					entityType: "FILE",
					action: "CREATE",
					entityId: created.fileId,
				});
				return created;
			} catch (error) {
				mapFileError(error);
			}
		}),
	adminGetDownloadUrl: adminProcedure
		.input(fileAdminByIdInputSchema)
		.handler(async ({ context, input }) => {
			try {
				return await createFileDownloadUrl({
					db: context.db,
					fileId: input.fileId,
				});
			} catch (error) {
				mapFileError(error);
			}
		}),
	adminDelete: adminProcedure
		.input(fileAdminByIdInputSchema)
		.handler(async ({ context, input }) => {
			try {
				const deleted = await deleteFile({
					db: context.db,
					fileId: input.fileId,
				});
				await logAdminMutation({
					context,
					entityType: "FILE",
					action: "DELETE",
					entityId: deleted.fileId,
				});
				return deleted;
			} catch (error) {
				mapFileError(error);
			}
		}),
});
