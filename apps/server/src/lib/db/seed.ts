import { eq } from "drizzle-orm";
import { toError } from "@/orpc/error-mapper";
import { auth } from "../auth/index.js";
import { db } from "./index.js";
import { user } from "./schema/auth.js";

async function seed() {
	console.log("Seeding database...");

	const adminEmail = "admin@example.com";
	const adminPassword = "Admin123!";
	const adminName = "Admin";

	const existingUsers = await db
		.select()
		.from(user)
		.where(eq(user.email, adminEmail))
		.limit(1);

	if (existingUsers.length > 0) {
		console.log("Admin user already exists, updating role...");
		await db
			.update(user)
			.set({ role: "admin" })
			.where(eq(user.email, adminEmail));
		console.log("Admin role updated!");
		return;
	}

	try {
		const result = (await auth.api.signUpEmail({
			body: {
				email: adminEmail,
				password: adminPassword,
				name: adminName,
			},
		})) as { user?: { id: string } };

		if (result.user) {
			await db
				.update(user)
				.set({ role: "admin", emailVerified: true })
				.where(eq(user.id, result.user.id));

			console.log("Admin user created successfully!");
			console.log(`Email: ${adminEmail}`);
			console.log(`Password: ${adminPassword}`);
		}
	} catch (error) {
		console.error("Error creating admin user:", error);
		throw toError(error);
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
