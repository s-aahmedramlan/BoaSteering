import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .slice(1, -1)
      .split(',')
      .map(Number);
  },
});

export const facts = pgTable('facts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  file_paths: text('file_paths').array().notNull().default(sql`'{}'::text[]`),
  author: text('author').notNull().default(''),
  repo: text('repo').notNull().default(''),
  created_at: timestamp('created_at').notNull().defaultNow(),
  hit_count: integer('hit_count').notNull().default(0),
  last_hit_at: timestamp('last_hit_at'),
  verified: boolean('verified').notNull().default(false),
  authors: text('authors').array().notNull().default(sql`'{}'::text[]`),
});

export type Fact = typeof facts.$inferSelect;
export type NewFact = typeof facts.$inferInsert;
