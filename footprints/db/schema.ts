import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const blogPosts = sqliteTable('blog_posts', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  authorId: text('author_id').notNull(),
  draftJson: text('draft_json').notNull(),
  publishedJson: text('published_json'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [uniqueIndex('blog_posts_slug_unique').on(table.slug)]);
