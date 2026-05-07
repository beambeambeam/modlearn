import type { DbClient } from "@/lib/db/orm";

export interface AnalyticsOverviewInput {
	from?: Date;
	to?: Date;
}

export interface AnalyticsLessonViewsInput {
	page?: number;
	limit?: number;
	from?: Date;
	to?: Date;
	search?: string;
}

export interface AnalyticsViewSessionsInput {
	page?: number;
	limit?: number;
	from?: Date;
	to?: Date;
	userId?: string;
	courseLessonId?: string;
}

export interface AnalyticsOverviewResult {
	totalViews: number;
	totalWatchDuration: number;
	generatedAt: Date;
}

export interface AnalyticsLessonViewItem {
	courseLessonId: string;
	courseId: string;
	courseTitle: string;
	title: string;
	aggregatedViews: number;
	aggregatedWatchDuration: number;
}

export interface AnalyticsViewSessionItem {
	id: string;
	courseLessonId: string;
	userId: string | null;
	viewedAt: Date;
	watchDuration: number | null;
	deviceType: string | null;
}

export interface AnalyticsPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface AnalyticsLessonViewsResult {
	items: AnalyticsLessonViewItem[];
	pagination: AnalyticsPagination;
}

export interface AnalyticsViewSessionsResult {
	items: AnalyticsViewSessionItem[];
	pagination: AnalyticsPagination;
}

export interface AnalyticsOverviewParams {
	db: DbClient;
	input: AnalyticsOverviewInput;
}

export interface AnalyticsLessonViewsParams {
	db: DbClient;
	input: AnalyticsLessonViewsInput;
}

export interface AnalyticsViewSessionsParams {
	db: DbClient;
	input: AnalyticsViewSessionsInput;
}
