import type { SQL } from "drizzle-orm";
import {
	and,
	count,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	lte,
	sql,
} from "drizzle-orm";
import { content, contentView } from "@/lib/db/schema";
import type {
	AnalyticsContentViewsParams,
	AnalyticsContentViewsResult,
	AnalyticsOverviewParams,
	AnalyticsOverviewResult,
	AnalyticsViewSessionsParams,
	AnalyticsViewSessionsResult,
} from "./analytics.types";

function toPagination(params: { page: number; limit: number; total: number }) {
	const { page, limit, total } = params;
	return {
		page,
		limit,
		total,
		totalPages: total === 0 ? 0 : Math.ceil(total / limit),
	};
}

function buildViewDateRangeWhere(params: {
	from?: Date;
	to?: Date;
}): SQL<unknown> | undefined {
	const { from, to } = params;
	const conditions: SQL<unknown>[] = [];

	if (from) {
		conditions.push(gte(contentView.viewedAt, from));
	}
	if (to) {
		conditions.push(lte(contentView.viewedAt, to));
	}

	if (conditions.length === 0) {
		return undefined;
	}

	return and(...conditions);
}

export async function getAnalyticsOverview(
	params: AnalyticsOverviewParams
): Promise<AnalyticsOverviewResult> {
	const { db, input } = params;
	const now = new Date();
	const viewDateWhere = buildViewDateRangeWhere({
		from: input.from,
		to: input.to,
	});

	const [totalsRow] = await db
		.select({
			totalViews: count(contentView.id),
			totalWatchDuration: sql<number>`coalesce(sum(${contentView.watchDuration}), 0)::int`,
		})
		.from(contentView)
		.where(viewDateWhere);

	return {
		totalViews: Number(totalsRow?.totalViews ?? 0),
		totalWatchDuration: Number(totalsRow?.totalWatchDuration ?? 0),
		generatedAt: now,
	};
}

export async function listContentViewsAnalytics(
	params: AnalyticsContentViewsParams
): Promise<AnalyticsContentViewsResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;
	const contentWhereConditions: SQL<unknown>[] = [eq(content.isDeleted, false)];

	if (input.contentType) {
		contentWhereConditions.push(eq(content.contentType, input.contentType));
	}

	const search = input.search?.trim();
	if (search) {
		contentWhereConditions.push(ilike(content.title, `%${search}%`));
	}

	const contentWhere = and(...contentWhereConditions);

	const [countRow] = await db
		.select({ total: count() })
		.from(content)
		.where(contentWhere);

	const total = Number(countRow?.total ?? 0);
	const contentRows = await db
		.select({
			id: content.id,
			title: content.title,
			contentType: content.contentType,
			viewCount: content.viewCount,
			createdAt: content.createdAt,
		})
		.from(content)
		.where(contentWhere)
		.orderBy(desc(content.viewCount), desc(content.createdAt), desc(content.id))
		.limit(limit)
		.offset(offset);

	if (contentRows.length === 0) {
		return {
			items: [],
			pagination: toPagination({ page, limit, total }),
		};
	}

	const contentIds = contentRows.map((row) => row.id);
	const viewConditions: SQL<unknown>[] = [
		inArray(contentView.contentId, contentIds),
	];
	const viewDateWhere = buildViewDateRangeWhere({
		from: input.from,
		to: input.to,
	});
	if (viewDateWhere) {
		viewConditions.push(viewDateWhere);
	}

	const aggregateRows = await db
		.select({
			contentId: contentView.contentId,
			aggregatedViews: count(contentView.id),
			aggregatedWatchDuration: sql<number>`coalesce(sum(${contentView.watchDuration}), 0)::int`,
		})
		.from(contentView)
		.where(and(...viewConditions))
		.groupBy(contentView.contentId);

	const aggregatesByContentId = new Map(
		aggregateRows.map((row) => [row.contentId, row])
	);

	const items = contentRows.map((row) => {
		const aggregate = aggregatesByContentId.get(row.id);
		return {
			contentId: row.id,
			title: row.title,
			contentType: row.contentType,
			aggregatedViews: Number(aggregate?.aggregatedViews ?? 0),
			aggregatedWatchDuration: Number(aggregate?.aggregatedWatchDuration ?? 0),
			cachedViewCount: Number(row.viewCount),
		};
	});

	return {
		items,
		pagination: toPagination({ page, limit, total }),
	};
}

export async function listViewSessionsAnalytics(
	params: AnalyticsViewSessionsParams
): Promise<AnalyticsViewSessionsResult> {
	const { db, input } = params;
	const page = input.page ?? 1;
	const limit = input.limit ?? 20;
	const offset = (page - 1) * limit;
	const whereConditions: SQL<unknown>[] = [];

	if (input.userId) {
		whereConditions.push(eq(contentView.userId, input.userId));
	}
	if (input.contentId) {
		whereConditions.push(eq(contentView.contentId, input.contentId));
	}
	if (input.from) {
		whereConditions.push(gte(contentView.viewedAt, input.from));
	}
	if (input.to) {
		whereConditions.push(lte(contentView.viewedAt, input.to));
	}

	const where =
		whereConditions.length > 0 ? and(...whereConditions) : undefined;
	const [countRow] = await db
		.select({ total: count() })
		.from(contentView)
		.where(where);
	const total = Number(countRow?.total ?? 0);

	const items = await db
		.select({
			id: contentView.id,
			contentId: contentView.contentId,
			userId: contentView.userId,
			viewedAt: contentView.viewedAt,
			watchDuration: contentView.watchDuration,
			deviceType: contentView.deviceType,
		})
		.from(contentView)
		.where(where)
		.orderBy(desc(contentView.viewedAt), desc(contentView.id))
		.limit(limit)
		.offset(offset);

	return {
		items: items.map((item) => ({
			...item,
			watchDuration:
				item.watchDuration === null ? null : Number(item.watchDuration),
		})),
		pagination: toPagination({ page, limit, total }),
	};
}
