// ─────────────────────────────────────────────────────────────
//  Seed demo customers + a few sample leads so the board isn't empty.
//  Runs against whichever backend is active (Postgres or JSON store).
//    npm run db:seed
//  Also invoked automatically the first time the dashboard loads if
//  the store is empty (see app/page.tsx → ensureSeed).
// ─────────────────────────────────────────────────────────────
import { store } from "./store";
import { ingestLead } from "../ingest/ingest";

const REPS = [
  { id: "rep_noa", name: "נועה שרון", regions: ["מרכז"], specialties: ["פרימיום", "דוחות"], capacity: 25 },
  { id: "rep_amir", name: "אמיר כהן", regions: ["צפון"], specialties: ["בסיס", "מנוי"], capacity: 25 },
  { id: "rep_tal", name: "טל לוי", regions: ["דרום"], specialties: ["שדרוג", "אינטגרציה"], capacity: 25 },
];

const CUSTOMERS = [
  {
    name: "דנה כהן",
    phone: "0521234567",
    email: "dana@acme.co.il",
    company: 'אקמה בע"מ',
    products: ["חבילת בסיס"],
    tags: ["VIP"],
    ownerId: "rep_noa",
  },
  {
    name: "יוסי לוי",
    phone: "0539876543",
    email: "yossi@techflow.io",
    company: "TechFlow",
    products: ["מנוי שנתי", "מודול דוחות"],
    tags: [],
    ownerId: "rep_amir",
  },
  {
    name: "מירי אברהם",
    phone: "0587654321",
    email: "miri@greenfields.co.il",
    company: "Green Fields",
    products: ["חבילת פרימיום"],
    tags: ["חידוש קרוב"],
    ownerId: "rep_noa",
  },
];

const SAMPLE_INBOUND = [
  {
    channel: "whatsapp_text" as const,
    from: "0501112233",
    text: "היי, קוראים לי רון מזרחי מחברת סטארלайт. מעוניין בהצעת מחיר לחבילת הפרימיום, זה די דחוף. הטלפון שלי 050-111-2233",
    source: "whatsapp",
  },
  {
    channel: "landing_qr" as const,
    from: "0522223344",
    source: "expo-2026",
    prefilled: {
      fullName: "שירה בן דוד",
      phone: "0522223344",
      email: "shira@example.com",
      productInterest: "מודול הדוחות המתקדם",
    },
  },
  {
    // existing customer → cross-sell
    channel: "whatsapp_text" as const,
    from: "0521234567",
    text: "שלום, רוצה לשמוע על שדרוג למודול הדוחות. כמה זה עולה?",
    source: "whatsapp",
  },
  {
    channel: "referral" as const,
    from: "0544445566",
    text: "הגיע דרך המלצה של דנה. איש קשר: אבי גולן, מעוניין בחבילת בסיס",
    source: "referral-dana",
  },
];

async function main() {
  console.log("Seeding reps…");
  for (const r of REPS) await store.upsertRep(r);
  console.log("Seeding customers…");
  for (const c of CUSTOMERS) await store.upsertCustomer(c);

  console.log("Seeding sample leads…");
  for (const s of SAMPLE_INBOUND) {
    const r = await ingestLead({ ...s, actor: "seed" });
    console.log(`  · ${r.lead.fullName ?? r.lead.phone} → ${r.lead.score}/100`);
  }
  console.log("Done.");
}

// Only run when executed directly (npm run db:seed), not on import.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /seed\.(ts|js|mjs)$/.test(process.argv[1]);
if (isMain) main().then(() => process.exit(0)).catch((e) => (console.error(e), process.exit(1)));

export async function ensureSeed(): Promise<void> {
  const existing = await store.listLeads();
  if (existing.length > 0) return;
  for (const r of REPS) await store.upsertRep(r);
  for (const c of CUSTOMERS) await store.upsertCustomer(c);
  for (const s of SAMPLE_INBOUND) await ingestLead({ ...s, actor: "seed" });
}
