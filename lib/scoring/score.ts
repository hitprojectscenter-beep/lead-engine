// ─────────────────────────────────────────────────────────────
//  Lead scoring engine (rule-based, transparent, 0..100).
//  Prioritises EXISTING CUSTOMERS (cross-sell/upsell) as requested:
//  an existing-customer match is the single biggest signal.
//  Every score comes with human-readable reasons for the sales rep.
// ─────────────────────────────────────────────────────────────
import type { Lead, LeadKind, LeadTemperature } from "../types";

export interface ScoreResult {
  score: number;
  temperature: LeadTemperature;
  kind: LeadKind;
  reasons: string[]; // Hebrew, shown on the lead card
}

// Buying-intent keywords (Hebrew + a few English) — strong signals.
const BUYING_SIGNALS = [
  "מחיר",
  "הצעת מחיר",
  "הצעה",
  "כמה עולה",
  "לקנות",
  "לרכוש",
  "רכישה",
  "דחוף",
  "בהקדם",
  "מעוניין",
  "מעוניינת",
  "להזמין",
  "הזמנה",
  "שדרוג",
  "לחדש",
  "חוזה",
  "תקציב",
  "מתי אפשר",
  "פגישה",
  "demo",
  "quote",
  "pricing",
  "upgrade",
];

const CHANNEL_BASE: Record<string, number> = {
  existing_customer: 40,
  referral: 30,
  whatsapp_voice: 25,
  phone: 25,
  whatsapp_text: 22,
  landing_qr: 20,
  landing_web: 18,
  walk_in: 20,
  email: 15,
  manual: 12,
};

export function scoreLead(lead: Partial<Lead>): ScoreResult {
  const reasons: string[] = [];
  let score = 0;

  const base = CHANNEL_BASE[lead.channel ?? "manual"] ?? 12;
  score += base;
  reasons.push(`ערוץ הגעה (${lead.channel}) — בסיס ${base}`);

  // Contact completeness → reachability
  if (lead.phone) {
    score += 10;
    reasons.push("יש טלפון (+10)");
  }
  if (lead.email) {
    score += 6;
    reasons.push("יש אימייל (+6)");
  }
  if (lead.fullName) {
    score += 5;
    reasons.push("יש שם מלא (+5)");
  }
  if (lead.company) {
    score += 4;
    reasons.push("יש שם חברה (+4)");
  }
  if (lead.productInterest) {
    score += 8;
    reasons.push("צוין מוצר/צורך ספציפי (+8)");
  }

  // The big one: existing customer → cross-sell/upsell opportunity
  if (lead.isExistingCustomer) {
    score += 30;
    reasons.push("לקוח קיים — הזדמנות Cross-sell/Upsell (+30)");
  }

  // Buying-intent keywords in the raw text / transcript
  const text = `${lead.rawText ?? ""} ${lead.transcript ?? ""} ${lead.notes ?? ""} ${
    lead.productInterest ?? ""
  }`.toLowerCase();
  const hits = BUYING_SIGNALS.filter((k) => text.includes(k.toLowerCase()));
  if (hits.length) {
    const bonus = Math.min(20, hits.length * 8);
    score += bonus;
    reasons.push(`איתותי רכישה (${hits.slice(0, 3).join(", ")}) (+${bonus})`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const temperature: LeadTemperature = score >= 70 ? "hot" : score >= 45 ? "warm" : "cold";

  // Kind: existing customer showing product intent → PQL; hot → SQL; else MQL
  let kind: LeadKind = "mql";
  if (lead.isExistingCustomer && (lead.productInterest || hits.length)) kind = "pql";
  else if (score >= 65) kind = "sql";

  return { score, temperature, kind, reasons };
}
