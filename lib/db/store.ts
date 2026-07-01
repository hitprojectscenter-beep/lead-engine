// ─────────────────────────────────────────────────────────────
//  Unified data store. Uses Postgres (Drizzle) when DATABASE_URL is
//  set, otherwise a file-backed JSON store under ./.data so the app
//  runs with zero setup. Same async interface either way.
// ─────────────────────────────────────────────────────────────
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { and, desc, eq, or } from "drizzle-orm";
import { db, hasDb } from "./client";
import {
  leadsTable,
  activitiesTable,
  customersTable,
  repsTable,
  enrollmentsTable,
} from "./schema";
import type { Activity, Customer, Enrollment, Lead, LeadStatus, Rep } from "../types";
import { newId, normalizeEmail, normalizePhone } from "../utils";

export interface LeadFilter {
  status?: LeadStatus;
  channel?: string;
  ownerId?: string;
  q?: string;
}

export interface Store {
  listLeads(filter?: LeadFilter): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | null>;
  createLead(input: Partial<Lead>): Promise<Lead>;
  updateLead(id: string, patch: Partial<Lead>): Promise<Lead | null>;
  deleteLead(id: string): Promise<boolean>;
  listActivities(leadId: string): Promise<Activity[]>;
  addActivity(input: Omit<Activity, "id" | "createdAt"> & { createdAt?: string }): Promise<Activity>;
  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  findCustomerByContact(phone?: string | null, email?: string | null): Promise<Customer | null>;
  upsertCustomer(c: Partial<Customer> & { name: string }): Promise<Customer>;

  listReps(): Promise<Rep[]>;
  getRep(id: string): Promise<Rep | null>;
  upsertRep(r: Partial<Rep> & { name: string }): Promise<Rep>;
  deleteRep(id: string): Promise<boolean>;

  listEnrollments(filter?: { leadId?: string; status?: string }): Promise<Enrollment[]>;
  createEnrollment(e: Omit<Enrollment, "id">): Promise<Enrollment>;
  updateEnrollment(id: string, patch: Partial<Enrollment>): Promise<Enrollment | null>;
}

// ── defaults ────────────────────────────────────────────────
function leadDefaults(input: Partial<Lead>): Lead {
  const now = new Date().toISOString();
  return {
    id: input.id ?? newId("lead"),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    fullName: input.fullName ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    company: input.company ?? null,
    productInterest: input.productInterest ?? null,
    notes: input.notes ?? null,
    rawText: input.rawText ?? null,
    transcript: input.transcript ?? null,
    status: input.status ?? "new",
    kind: input.kind ?? "mql",
    channel: input.channel ?? "manual",
    source: input.source ?? null,
    score: input.score ?? 0,
    temperature: input.temperature ?? "cold",
    ownerId: input.ownerId ?? null,
    customerId: input.customerId ?? null,
    isExistingCustomer: input.isExistingCustomer ?? false,
    mediaUrls: input.mediaUrls ?? [],
  };
}

function matchesFilter(l: Lead, f?: LeadFilter): boolean {
  if (!f) return true;
  if (f.status && l.status !== f.status) return false;
  if (f.channel && l.channel !== f.channel) return false;
  if (f.ownerId && l.ownerId !== f.ownerId) return false;
  if (f.q) {
    const hay = [l.fullName, l.phone, l.email, l.company, l.productInterest, l.notes, l.rawText]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(f.q.toLowerCase())) return false;
  }
  return true;
}

// ── JSON file store ─────────────────────────────────────────
// On Vercel (read-only FS except /tmp) write to a temp dir so the app
// doesn't crash before DATABASE_URL is configured. NOTE: /tmp is ephemeral
// and per-instance — this is a demo fallback only; production needs Postgres.
const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "lead-engine-data")
  : path.join(process.cwd(), ".data");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), "utf8");
}

const jsonStore: Store = {
  async listLeads(filter) {
    const all = await readJson<Lead[]>("leads.json", []);
    return all
      .filter((l) => matchesFilter(l, filter))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getLead(id) {
    const all = await readJson<Lead[]>("leads.json", []);
    return all.find((l) => l.id === id) ?? null;
  },
  async createLead(input) {
    const all = await readJson<Lead[]>("leads.json", []);
    const lead = leadDefaults(input);
    all.push(lead);
    await writeJson("leads.json", all);
    return lead;
  },
  async updateLead(id, patch) {
    const all = await readJson<Lead[]>("leads.json", []);
    const i = all.findIndex((l) => l.id === id);
    if (i < 0) return null;
    all[i] = { ...all[i], ...patch, id, updatedAt: new Date().toISOString() };
    await writeJson("leads.json", all);
    return all[i];
  },
  async deleteLead(id) {
    const all = await readJson<Lead[]>("leads.json", []);
    const next = all.filter((l) => l.id !== id);
    if (next.length === all.length) return false;
    await writeJson("leads.json", next);
    return true;
  },
  async listActivities(leadId) {
    const all = await readJson<Activity[]>("activities.json", []);
    return all.filter((a) => a.leadId === leadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async addActivity(input) {
    const all = await readJson<Activity[]>("activities.json", []);
    const act: Activity = { id: newId("act"), createdAt: input.createdAt ?? new Date().toISOString(), ...input };
    all.push(act);
    await writeJson("activities.json", all);
    return act;
  },
  async listCustomers() {
    return readJson<Customer[]>("customers.json", []);
  },
  async getCustomer(id) {
    const all = await readJson<Customer[]>("customers.json", []);
    return all.find((c) => c.id === id) ?? null;
  },
  async findCustomerByContact(phone, email) {
    const all = await readJson<Customer[]>("customers.json", []);
    const np = normalizePhone(phone);
    const ne = normalizeEmail(email);
    return (
      all.find(
        (c) => (np && normalizePhone(c.phone) === np) || (ne && normalizeEmail(c.email) === ne),
      ) ?? null
    );
  },
  async upsertCustomer(c) {
    const all = await readJson<Customer[]>("customers.json", []);
    const existing = c.id ? all.findIndex((x) => x.id === c.id) : -1;
    const record: Customer = {
      id: c.id ?? newId("cust"),
      name: c.name,
      phone: c.phone ?? null,
      email: c.email ?? null,
      company: c.company ?? null,
      ownerId: c.ownerId ?? null,
      products: c.products ?? [],
      tags: c.tags ?? [],
    };
    if (existing >= 0) all[existing] = record;
    else all.push(record);
    await writeJson("customers.json", all);
    return record;
  },
  async listReps() {
    return readJson<Rep[]>("reps.json", []);
  },
  async getRep(id) {
    const all = await readJson<Rep[]>("reps.json", []);
    return all.find((r) => r.id === id) ?? null;
  },
  async upsertRep(r) {
    const all = await readJson<Rep[]>("reps.json", []);
    const record: Rep = {
      id: r.id ?? newId("rep"),
      name: r.name,
      active: r.active ?? true,
      regions: r.regions ?? [],
      specialties: r.specialties ?? [],
      capacity: r.capacity ?? 25,
    };
    const i = r.id ? all.findIndex((x) => x.id === r.id) : -1;
    if (i >= 0) all[i] = record;
    else all.push(record);
    await writeJson("reps.json", all);
    return record;
  },
  async deleteRep(id) {
    const all = await readJson<Rep[]>("reps.json", []);
    const next = all.filter((r) => r.id !== id);
    if (next.length === all.length) return false;
    await writeJson("reps.json", next);
    return true;
  },
  async listEnrollments(filter) {
    const all = await readJson<Enrollment[]>("enrollments.json", []);
    return all.filter(
      (e) =>
        (!filter?.leadId || e.leadId === filter.leadId) &&
        (!filter?.status || e.status === filter.status),
    );
  },
  async createEnrollment(e) {
    const all = await readJson<Enrollment[]>("enrollments.json", []);
    const record: Enrollment = { id: newId("enr"), ...e };
    all.push(record);
    await writeJson("enrollments.json", all);
    return record;
  },
  async updateEnrollment(id, patch) {
    const all = await readJson<Enrollment[]>("enrollments.json", []);
    const i = all.findIndex((e) => e.id === id);
    if (i < 0) return null;
    all[i] = { ...all[i], ...patch, id };
    await writeJson("enrollments.json", all);
    return all[i];
  },
};

// ── Postgres store ──────────────────────────────────────────
function rowToLead(r: typeof leadsTable.$inferSelect): Lead {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    status: r.status as Lead["status"],
    kind: r.kind as Lead["kind"],
    channel: r.channel as Lead["channel"],
    temperature: r.temperature as Lead["temperature"],
    mediaUrls: r.mediaUrls ?? [],
  };
}

const pgStore: Store = {
  async listLeads(filter) {
    const conds = [];
    if (filter?.status) conds.push(eq(leadsTable.status, filter.status));
    if (filter?.channel) conds.push(eq(leadsTable.channel, filter.channel));
    if (filter?.ownerId) conds.push(eq(leadsTable.ownerId, filter.ownerId));
    const rows = await db!
      .select()
      .from(leadsTable)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(leadsTable.createdAt));
    let leads = rows.map(rowToLead);
    if (filter?.q) leads = leads.filter((l) => matchesFilter(l, { q: filter.q }));
    return leads;
  },
  async getLead(id) {
    const rows = await db!.select().from(leadsTable).where(eq(leadsTable.id, id)).limit(1);
    return rows[0] ? rowToLead(rows[0]) : null;
  },
  async createLead(input) {
    const lead = leadDefaults(input);
    await db!.insert(leadsTable).values({
      ...lead,
      createdAt: new Date(lead.createdAt),
      updatedAt: new Date(lead.updatedAt),
    });
    return lead;
  },
  async updateLead(id, patch) {
    const { id: _drop, createdAt: _c, ...rest } = patch as Lead;
    const rows = await db!
      .update(leadsTable)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(leadsTable.id, id))
      .returning();
    return rows[0] ? rowToLead(rows[0]) : null;
  },
  async deleteLead(id) {
    const rows = await db!.delete(leadsTable).where(eq(leadsTable.id, id)).returning();
    return rows.length > 0;
  },
  async listActivities(leadId) {
    const rows = await db!
      .select()
      .from(activitiesTable)
      .where(eq(activitiesTable.leadId, leadId))
      .orderBy(desc(activitiesTable.createdAt));
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      kind: r.kind as Activity["kind"],
      meta: r.meta ?? undefined,
    }));
  },
  async addActivity(input) {
    const act: Activity = { id: newId("act"), createdAt: input.createdAt ?? new Date().toISOString(), ...input };
    await db!.insert(activitiesTable).values({ ...act, createdAt: new Date(act.createdAt) });
    return act;
  },
  async listCustomers() {
    const rows = await db!.select().from(customersTable);
    return rows.map((r) => ({ ...r, products: r.products ?? [], tags: r.tags ?? [] }));
  },
  async getCustomer(id) {
    const rows = await db!.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    const r = rows[0];
    return r ? { ...r, products: r.products ?? [], tags: r.tags ?? [] } : null;
  },
  async findCustomerByContact(phone, email) {
    const np = normalizePhone(phone);
    const ne = normalizeEmail(email);
    if (!np && !ne) return null;
    const conds = [];
    if (np) conds.push(eq(customersTable.phone, np));
    if (ne) conds.push(eq(customersTable.email, ne));
    const rows = await db!
      .select()
      .from(customersTable)
      .where(or(...conds))
      .limit(1);
    const r = rows[0];
    return r ? { ...r, products: r.products ?? [], tags: r.tags ?? [] } : null;
  },
  async upsertCustomer(c) {
    const record: Customer = {
      id: c.id ?? newId("cust"),
      name: c.name,
      phone: normalizePhone(c.phone),
      email: normalizeEmail(c.email),
      company: c.company ?? null,
      ownerId: c.ownerId ?? null,
      products: c.products ?? [],
      tags: c.tags ?? [],
    };
    await db!
      .insert(customersTable)
      .values(record)
      .onConflictDoUpdate({ target: customersTable.id, set: record });
    return record;
  },
  async listReps() {
    const rows = await db!.select().from(repsTable);
    return rows.map((r) => ({ ...r, regions: r.regions ?? [], specialties: r.specialties ?? [] }));
  },
  async getRep(id) {
    const rows = await db!.select().from(repsTable).where(eq(repsTable.id, id)).limit(1);
    const r = rows[0];
    return r ? { ...r, regions: r.regions ?? [], specialties: r.specialties ?? [] } : null;
  },
  async upsertRep(r) {
    const record: Rep = {
      id: r.id ?? newId("rep"),
      name: r.name,
      active: r.active ?? true,
      regions: r.regions ?? [],
      specialties: r.specialties ?? [],
      capacity: r.capacity ?? 25,
    };
    await db!
      .insert(repsTable)
      .values(record)
      .onConflictDoUpdate({ target: repsTable.id, set: record });
    return record;
  },
  async deleteRep(id) {
    const rows = await db!.delete(repsTable).where(eq(repsTable.id, id)).returning();
    return rows.length > 0;
  },
  async listEnrollments(filter) {
    const conds = [];
    if (filter?.leadId) conds.push(eq(enrollmentsTable.leadId, filter.leadId));
    if (filter?.status) conds.push(eq(enrollmentsTable.status, filter.status));
    const rows = await db!
      .select()
      .from(enrollmentsTable)
      .where(conds.length ? and(...conds) : undefined);
    return rows.map((r) => ({
      ...r,
      enrolledAt: r.enrolledAt.toISOString(),
      nextRunAt: r.nextRunAt.toISOString(),
      lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
      status: r.status as Enrollment["status"],
    }));
  },
  async createEnrollment(e) {
    const record: Enrollment = { id: newId("enr"), ...e };
    await db!.insert(enrollmentsTable).values({
      ...record,
      enrolledAt: new Date(record.enrolledAt),
      nextRunAt: new Date(record.nextRunAt),
      lastRunAt: record.lastRunAt ? new Date(record.lastRunAt) : null,
    });
    return record;
  },
  async updateEnrollment(id, patch) {
    const set: Record<string, unknown> = { ...patch };
    delete set.id;
    if (patch.nextRunAt) set.nextRunAt = new Date(patch.nextRunAt);
    if (patch.lastRunAt) set.lastRunAt = new Date(patch.lastRunAt);
    if (patch.enrolledAt) set.enrolledAt = new Date(patch.enrolledAt);
    const rows = await db!
      .update(enrollmentsTable)
      .set(set)
      .where(eq(enrollmentsTable.id, id))
      .returning();
    const r = rows[0];
    return r
      ? {
          ...r,
          enrolledAt: r.enrolledAt.toISOString(),
          nextRunAt: r.nextRunAt.toISOString(),
          lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
          status: r.status as Enrollment["status"],
        }
      : null;
  },
};

export const store: Store = hasDb ? pgStore : jsonStore;
export const usingDb = hasDb;
