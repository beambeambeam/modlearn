export function normalizeSlug(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function isUniqueViolation(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	const value = error as { code?: string; message?: string };
	return (
		value.code === "23505" ||
		value.message?.toLowerCase().includes("unique") === true
	);
}
