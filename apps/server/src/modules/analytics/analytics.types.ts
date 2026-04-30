import type { DbClient } from "@/lib/db/orm";
import type { contentTypeEnum } from "@/lib/db/schema";

export type AnalyticsContentType = (typeof contentTypeEnum.enumValues)[number];

export interface AnalyticsOverviewInput {
	from?: Date;
	to?: Date;
}

export interface AnalyticsContentViewsInput {
	page?: number;
	limit?: number;
	from?: Date;
	to?: Date;
	contentType?: AnalyticsContentType;
	search?: string;
}

export interface AnalyticsViewSessionsInput {
	page?: number;
	limit?: number;
	from?: Date;
	to?: Date;
	userId?: string;
	contentId?: string;
}

export interface AnalyticsOverviewResult {
	totalViews: number;
	totalWatchDuration: number;
	generatedAt: Date;
}

export interface AnalyticsContentViewItem {
	contentId: string;
	title: string;
	contentType: AnalyticsContentType;
	aggregatedViews: number;
	aggregatedWatchDuration: number;
	cachedViewCount: number;
}

export interface AnalyticsViewSessionItem {
	id: string;
	contentId: string;
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

export interface AnalyticsContentViewsResult {
	items: AnalyticsContentViewItem[];
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

export interface AnalyticsContentViewsParams {
	db: DbClient;
	input: AnalyticsContentViewsInput;
}

export interface AnalyticsViewSessionsParams {
	db: DbClient;
	input: AnalyticsViewSessionsInput;
}
