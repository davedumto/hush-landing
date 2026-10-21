import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  type: text("type").notNull(), // "bug" | "feature"
  title: text("title").notNull(),
  fields: jsonb("fields").notNull(), // { whatHappened?, steps?, expected?, featureDescription? }
  model: text("model"),
  replyEmail: text("reply_email"),
  appVersion: text("app_version"),
  appBuild: text("app_build"),
  macosVersion: text("macos_version"),
  macModel: text("mac_model"),
  profileName: text("profile_name"),
  locale: text("locale"),
  diagnostics: text("diagnostics"),
  clientUuid: text("client_uuid"),
  ipHash: text("ip_hash"),
  status: text("status").notNull().default("new"), // "new" | "seen" | "done"
  discordSent: boolean("discord_sent").notNull().default(false),
});

export const rateEvents = pgTable(
  "rate_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    keyHash: text("key_hash").notNull(),
    kind: text("kind").notNull(), // "ip" | "client"
  },
  (table) => [index("rate_events_key_hash_created_at_idx").on(table.keyHash, table.createdAt)]
);
