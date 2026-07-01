import {
  pgSchema,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// Dedicated schema so this app can share a Neon/Postgres instance safely.
export const leads = pgSchema("leads");

export const leadsTable = leads.table(
  "leads",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),

    fullName: text("full_name"),
    phone: text("phone"),
    email: text("email"),
    company: text("company"),

    productInterest: text("product_interest"),
    notes: text("notes"),
    rawText: text("raw_text"),
    transcript: text("transcript"),

    status: text("status").notNull().default("new"),
    kind: text("kind").notNull().default("mql"),
    channel: text("channel").notNull().default("manual"),
    source: text("source"),
    score: integer("score").notNull().default(0),
    temperature: text("temperature").notNull().default("cold"),
    ownerId: text("owner_id"),

    customerId: text("customer_id"),
    isExistingCustomer: boolean("is_existing_customer").notNull().default(false),

    mediaUrls: jsonb("media_urls").$type<string[]>().notNull().default([]),
  },
  (t) => ({
    statusIdx: index("leads_status_idx").on(t.status),
    phoneIdx: index("leads_phone_idx").on(t.phone),
    emailIdx: index("leads_email_idx").on(t.email),
    createdIdx: index("leads_created_idx").on(t.createdAt),
  }),
);

export const activitiesTable = leads.table(
  "activities",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    kind: text("kind").notNull(),
    actor: text("actor").notNull().default("system"),
    message: text("message").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
  },
  (t) => ({
    leadIdx: index("activities_lead_idx").on(t.leadId),
  }),
);

export const customersTable = leads.table(
  "customers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    company: text("company"),
    ownerId: text("owner_id"),
    products: jsonb("products").$type<string[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
  },
  (t) => ({
    phoneIdx: index("customers_phone_idx").on(t.phone),
    emailIdx: index("customers_email_idx").on(t.email),
  }),
);
