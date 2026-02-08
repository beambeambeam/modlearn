import { eq } from "drizzle-orm";
import { auth } from "../auth.js";
import { db } from "./index.js";
import { user } from "./schema/auth.js";

async function seed() {
	console.log("Seeding database...");

	const superAdminEmail = "superadmin@example.com";
	const superAdminPassword = "SuperAdmin123!";
	const superAdminName = "Super Admin";

	const existingUsers = await db
		.select()
		.from(user)
		.where(eq(user.email, superAdminEmail))
		.limit(1);

	if (existingUsers.length > 0) {
		console.log("Super admin user already exists, updating role...");
		await db
			.update(user)
			.set({ role: "superadmin" })
			.where(eq(user.email, superAdminEmail));
		console.log("Super admin role updated!");
		return;
	}

	try {
		const result = (await auth.api.signUpEmail({
			body: {
				email: superAdminEmail,
				password: superAdminPassword,
				name: superAdminName,
			},
		})) as { user?: { id: string } };

		if (result.user) {
			await db
				.update(user)
				.set({ role: "superadmin", emailVerified: true })
				.where(eq(user.id, result.user.id));

			console.log("Super admin user created successfully!");
			console.log(`Email: ${superAdminEmail}`);
			console.log(`Password: ${superAdminPassword}`);
		}
	} catch (error) {
		console.error("Error creating super admin user:", error);
		throw error;
	}
}

seed()
	.catch((error) => {
		console.error("Error seeding database:", error);
		process.exit(1);
	})
	.finally(() => {
		process.exit(0);
	});
