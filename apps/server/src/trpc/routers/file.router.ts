import {
	createFileDownloadUrl,
	createFileUploadRequest,
	deleteFile,
} from "@/modules/file/file.service";
import {
	fileAdminByIdInputSchema,
	fileAdminCreateUploadRequestInputSchema,
} from "@/modules/file/file.validators";
import { adminProcedure, router } from "../index";
import { logAdminMutation } from "./_audit";
import { mapFileError } from "./router.utils";

export const fileRouter = router({
	adminCreateUploadRequest: adminProcedure
		.input(fileAdminCreateUploadRequestInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				const created = await createFileUploadRequest({
					db: ctx.db,
					input: {
						...input,
						uploaderId: ctx.session.user.id,
					},
				});
				await logAdminMutation({
					ctx,
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
				const deleted = await deleteFile({
					db: ctx.db,
					fileId: input.fileId,
				});
				await logAdminMutation({
					ctx,
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
