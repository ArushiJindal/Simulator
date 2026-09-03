import { integer, pgTable, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const posts = pgTable('posts', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    title: varchar({ length: 255 }).notNull(),
    content: text().notNull().default('')
});

// Column names are lowercase to match the existing unquoted `videoid` columns
// already in the database (Postgres folds unquoted identifiers to lowercase).
export const summaries = pgTable('summaries', {
    videoId: varchar('videoid', { length: 32 }).primaryKey(),
    content: text('content').notNull(),
    channelName: text('channelname'),
    publishedAt: timestamp('publishedat', { withTimezone: true })
});

export const transcripts = pgTable('transcripts', {
    videoId: varchar('videoid', { length: 32 }).primaryKey(),
    content: text('content').notNull()
});

// Stores each one-off "paste a URL + your own prompt" analysis so its
// result can be polled for and re-shown without re-running the AI call.
export const adhocAnalyses = pgTable('adhoc_analyses', {
    id: varchar('id', { length: 36 }).primaryKey(),
    videoId: varchar('videoid', { length: 32 }).notNull(),
    promptText: text('prompttext').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    result: text('result'),
    createdAt: timestamp('createdat', { withTimezone: true }).notNull().defaultNow()
});

// Stores each channel-summary AI query so its result can be polled for.
export const insightQueries = pgTable('insight_queries', {
    id: varchar('id', { length: 36 }).primaryKey(),
    queryText: text('querytext').notNull(),
    channels: text('channels').notNull(), // comma-separated channel names, or 'ALL'
    startDate: timestamp('startdate', { withTimezone: true }),
    endDate: timestamp('enddate', { withTimezone: true }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    answer: text('answer'),
    videoCount: integer('videocount'),
    createdAt: timestamp('createdat', { withTimezone: true }).notNull().defaultNow()
});