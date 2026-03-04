import { logAdminMutation } from "@/modules/admin-audit/admin-audit.service";
import {
	createFileDownloadUrl,
	createFileUploadRequest,
	deleteFile,
} from "@/modules/file/file.service";
import {
	fileAdminByIdInputSchema,
	fileAdminCreateUploadRequestInputSchema,
	fileAdminCreateUploadRequestOutputSchema,
	fileAdminDeleteOutputSchema,
	fileAdminGetDownloadUrlOutputSchema,
} from "@/modules/file/file.validators";
import { adminProcedure, router } from "@/orpc";

export const fileRouter = router({
	adminCreateUploadRequest: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/file/adminCreateUploadRequest",
			tags: ["File Admin"],
			summary: "Create File Upload Request",
			description:
				"Requires admin or superadmin role. Creates signed upload details and file metadata.",
		})
		.input(fileAdminCreateUploadRequestInputSchema)
		.output(fileAdminCreateUploadRequestOutputSchema)
		.handler(async ({ context, input }) => {
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
		}),
	adminGetDownloadUrl: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/file/adminGetDownloadUrl",
			tags: ["File Admin"],
			summary: "Create File Download URL",
			description:
				"Requires admin or superadmin role. Returns a signed download URL for a file.",
		})
		.input(fileAdminByIdInputSchema)
		.output(fileAdminGetDownloadUrlOutputSchema)
		.handler(({ context, input }) => {
			return createFileDownloadUrl({
				db: context.db,
				fileId: input.fileId,
			});
		}),
	adminDelete: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/file/adminDelete",
			tags: ["File Admin"],
			summary: "Delete File",
			description:
				"Requires admin or superadmin role. Deletes file metadata and backing object reference.",
		})
		.input(fileAdminByIdInputSchema)
		.output(fileAdminDeleteOutputSchema)
		.handler(async ({ context, input }) => {
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
		}),
});
