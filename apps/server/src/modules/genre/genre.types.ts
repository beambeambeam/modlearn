import type { genre } from "@/lib/db/schema";

export interface GenreListInput {
	search?: string;
	page?: number;
	limit?: number;
}

export interface GenreByIdInput {
	id: string;
}

export interface GenreAdminCreateInput {
	title: string;
	description?: string | null;
	slug: string;
}

export interface GenreAdminUpdateInput {
	id: string;
	patch: Partial<GenreAdminCreateInput>;
}

export interface GenreAdminDeleteInput {
	id: string;
}

export interface GenrePagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface GenreListResult {
	items: (typeof genre.$inferSelect)[];
	pagination: GenrePagination;
}

export class GenreNotFoundError extends Error {
	constructor() {
		super("Genre not found");
		this.name = "GenreNotFoundError";
	}
}

export class GenreSlugConflictError extends Error {
	constructor() {
		super("Genre slug already exists");
		this.name = "GenreSlugConflictError";
	}
}
