import { integer, pgTable, varchar, text } from 'drizzle-orm/pg-core';

export const posts = pgTable('posts', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    title: varchar({ length: 255 }).notNull(),
    content: text().notNull().default('')
});

// Column names are lowercase to match the existing unquoted `videoid` columns
// already in the database (Postgres folds unquoted identifiers to lowercase).
export const summaries = pgTable('summaries', {
    videoId: varchar('videoid', { length: 32 }).primaryKey(),
    content: text('content').notNull()
});

export const transcripts = pgTable('transcripts', {
    videoId: varchar('videoid', { length: 32 }).primaryKey(),
    content: text('content').notNull()
});