// ─────────────────────────────────────────────────────────────
//  Domain model — shared between server (repo/API) and client (UI).
//  Hebrew-first product; enum *values* are stable English codes,
//  labels live in LABELS below.
// ─────────────────────────────────────────────────────────────

/** Lifecycle stage of a lead (the kanban columns). */
export const LEAD_STATUSES = [
  "new", // חדש — just captured, not yet touched
  "contacted", // נוצר קשר — first outreach done
  "qualified", // מוסמך — passed qualification (SQL)
  "nurturing", // בטיפוח — not ready, in drip / follow-up
  "proposal", // הצעה — proposal / quote sent
  "won", // נסגר בהצלחה — converted to customer
  "lost", // אבוד — disqualified / no-go
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const CLOSED_STATUSES: LeadStatus[] = ["won", "lost"];
export const isClosed = (s: LeadStatus) => CLOSED_STATUSES.includes(s);
export const isOpen = (s: LeadStatus) => !isClosed(s);

/** Qualification type. */
export const LEAD_KINDS = ["mql", "sql", "pql"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

/** Where the lead came in from. */
export const LEAD_CHANNELS = [
  "whatsapp_text",
  "whatsapp_voice",
  "landing_qr",
  "landing_web",
  "email",
  "phone",
  "referral",
  "walk_in",
  "existing_customer",
  "manual",
] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];

export const LEAD_TEMPERATURES = ["hot", "warm", "cold"] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

/** A single lead record. */
export interface Lead {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO

  // Identity / contact
  fullName: string | null;
  phone: string | null; // E.164 where possible
  email: string | null;
  company: string | null;

  // Interest
  productInterest: string | null; // free text — what they want
  notes: string | null; // agent / parsed notes
  rawText: string | null; // original message / transcript
  transcript: string | null; // if the source was audio

  // Pipeline
  status: LeadStatus;
  kind: LeadKind;
  channel: LeadChannel;
  source: string | null; // finer-grained: campaign / landing slug / referrer name
  score: number; // 0..100
  temperature: LeadTemperature;
  ownerId: string | null; // assigned sales rep

  // Cross-sell / existing customer linkage
  customerId: string | null; // matched existing customer, if any
  isExistingCustomer: boolean;

  // Media (voice notes, images) stored as URLs
  mediaUrls: string[];
}

/** Timeline entry attached to a lead. */
export const ACTIVITY_KINDS = [
  "created",
  "ingested", // arrived via a channel
  "transcribed",
  "parsed",
  "enriched",
  "scored",
  "status_change",
  "assigned",
  "note",
  "outreach", // message sent to the lead
  "customer_matched",
  "auto_reply",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface Activity {
  id: string;
  leadId: string;
  createdAt: string;
  kind: ActivityKind;
  actor: string; // "system" | userId | "whatsapp" ...
  message: string;
  meta?: Record<string, unknown>;
}

/** Minimal existing-customer record for cross-sell matching. */
export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  ownerId: string | null;
  products: string[]; // products they already own
  tags: string[];
}

// ── Hebrew labels ───────────────────────────────────────────

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "חדש",
  contacted: "נוצר קשר",
  qualified: "מוסמך (SQL)",
  nurturing: "בטיפוח",
  proposal: "הצעה נשלחה",
  won: "נסגר בהצלחה",
  lost: "אבוד",
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "#3b6fed",
  contacted: "#0ea5e9",
  qualified: "#8b5cf6",
  nurturing: "#f59e0b",
  proposal: "#ec4899",
  won: "#16a34a",
  lost: "#94a3b8",
};

export const KIND_LABELS: Record<LeadKind, string> = {
  mql: "ליד שיווקי (MQL)",
  sql: "ליד מכירתי (SQL)",
  pql: "ליד מבוסס-מוצר (PQL)",
};

export const CHANNEL_LABELS: Record<LeadChannel, string> = {
  whatsapp_text: "ווטסאפ (טקסט)",
  whatsapp_voice: "ווטסאפ (הקלטה)",
  landing_qr: "דף נחיתה (QR)",
  landing_web: "דף נחיתה (אתר)",
  email: "אימייל",
  phone: "טלפון",
  referral: "המלצה / מכר",
  walk_in: "פרונטלי",
  existing_customer: "לקוח קיים",
  manual: "הזנה ידנית",
};

export const TEMPERATURE_LABELS: Record<LeadTemperature, string> = {
  hot: "חם",
  warm: "פושר",
  cold: "קר",
};

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  created: "נוצר",
  ingested: "נקלט מהערוץ",
  transcribed: "תומלל",
  parsed: "חולצו פרטים",
  enriched: "הועשר",
  scored: "נוקד",
  status_change: "שינוי סטטוס",
  assigned: "שויך לנציג",
  note: "הערה",
  outreach: "פנייה ללקוח",
  customer_matched: "זוהה לקוח קיים",
  auto_reply: "מענה אוטומטי",
};

/** Structured fields the parser tries to extract from free text / a transcript. */
export interface ParsedLead {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  productInterest: string | null;
  notes: string | null;
  temperature: LeadTemperature | null;
}
