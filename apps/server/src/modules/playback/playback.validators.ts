import { z } from "zod";

const deviceTypeSchema = z.string().trim().min(1).max(64).nullable().optional();

const playbackSessionStatusSchema = z.enum([
	"ACTIVE",
	"PAUSED",
	"STOPPED",
	"ENDED",
	"EXPIRED",
]);

const playbackEventTypeSchema = z.enum([
	"PLAY",
	"PAUSE",
	"RESUME",
	"SEEK",
	"STOP",
]);

export const playbackCreateSessionInputSchema = z.object({
	contentId: z.uuid(),
	playlistId: z.uuid().nullable().optional(),
	deviceType: deviceTypeSchema,
});

const playbackSessionAuthInputSchema = z.object({
	sessionId: z.uuid(),
	playbackToken: z.string().trim().min(16).max(512),
});

const playbackLifecycleBaseInputSchema = playbackSessionAuthInputSchema.extend({
	position: z.number().int().min(0),
	duration: z.number().int().positive(),
	deviceType: deviceTypeSchema,
});

export const playbackPlayInputSchema = playbackLifecycleBaseInputSchema;

export const playbackPauseInputSchema = playbackLifecycleBaseInputSchema;

export const playbackResumeInputSchema = playbackLifecycleBaseInputSchema;

export const playbackSeekInputSchema = playbackLifecycleBaseInputSchema.extend({
	fromPosition: z.number().int().min(0).optional(),
});

export const playbackStopInputSchema = playbackLifecycleBaseInputSchema;

export const playbackGetSessionInputSchema = playbackSessionAuthInputSchema;
export const playbackRefreshSessionInputSchema = playbackSessionAuthInputSchema;

export const playbackSessionSchema = z.object({
	id: z.uuid(),
	userId: z.string(),
	contentId: z.uuid(),
	playlistId: z.uuid().nullable(),
	playbackToken: z.string(),
	status: playbackSessionStatusSchema,
	startedAt: z.date(),
	lastEventAt: z.date(),
	endedAt: z.date().nullable(),
	lastPosition: z.number().int(),
	duration: z.number().int(),
	deviceType: z.string().nullable(),
	expiresAt: z.date(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const playbackEventSchema = z.object({
	id: z.uuid(),
	sessionId: z.uuid(),
	eventType: playbackEventTypeSchema,
	position: z.number().int(),
	duration: z.number().int(),
	deviceType: z.string().nullable(),
	createdAt: z.date(),
});

export const playbackSessionStateOutputSchema = z.object({
	session: playbackSessionSchema,
	progressPercent: z.number(),
	isCompleted: z.boolean(),
});

export const playbackCreateSessionOutputSchema = z.object({
	sessionId: z.uuid(),
	playbackToken: z.string(),
	streamUrl: z.url(),
	streamUrlExpiresAt: z.date().nullable(),
	tokenExpiresAt: z.date(),
	resumePosition: z.number().int().min(0),
	content: z.object({
		id: z.uuid(),
		title: z.string(),
		duration: z.number().int().nullable(),
		contentType: z.enum(["MOVIE", "SERIES", "EPISODE", "MUSIC"]),
		fileId: z.uuid().nullable(),
	}),
});

export const playbackLifecycleOutputSchema = z.object({
	event: playbackEventSchema,
	session: playbackSessionSchema,
	progressPercent: z.number(),
	isCompleted: z.boolean(),
});

export const playbackRefreshSessionOutputSchema = z.object({
	sessionId: z.uuid(),
	playbackToken: z.string(),
	tokenExpiresAt: z.date(),
});
