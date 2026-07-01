// ─────────────────────────────────────────────────────────────
//  Extract structured lead fields from free text (a WhatsApp message
//  or a voice-note transcript). Uses an LLM when available, else a
//  transparent heuristic parser. Never throws — parsing failures fall
//  back to heuristics so a lead is always captured.
// ─────────────────────────────────────────────────────────────
import type { ParsedLead } from "../types";
import { extractEmail, extractPhone } from "../utils";
import { getOpenAI, hasOpenAI } from "./transcribe";

const SYSTEM = `אתה עוזר שמחלץ פרטי ליד (לקוח פוטנציאלי) מטקסט חופשי בעברית או אנגלית.
הטקסט יכול להיות הודעת ווטסאפ או תמלול הקלטה שבה מישהו מוסר פרטים על ליד.
החזר אך ורק JSON תקין (ללא הסברים) עם המפתחות:
fullName, phone, email, company, productInterest, notes, temperature.
- phone: מספר טלפון אם קיים, אחרת null.
- email: אימייל אם קיים, אחרת null.
- productInterest: במה הליד מעוניין (מוצר/שירות/צורך), בקצרה.
- notes: סיכום קצר של יתר המידע הרלוונטי לנציג המכירות.
- temperature: "hot" אם יש כוונת רכישה מיידית/דחיפות, "warm" אם יש עניין ברור, "cold" אם רק בירור כללי.
כל שדה שאין לגביו מידע — החזר null.`;

export async function parseLead(text: string): Promise<ParsedLead> {
  const clean = (text ?? "").trim();
  if (!clean) return heuristicParse("");

  if (hasOpenAI) {
    try {
      return await llmParse(clean);
    } catch {
      // fall through to heuristics
    }
  }
  return heuristicParse(clean);
}

async function llmParse(text: string): Promise<ParsedLead> {
  const openai = getOpenAI()!;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const resp = await openai.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: text },
    ],
  });
  const raw = resp.choices[0]?.message?.content ?? "{}";
  const obj = JSON.parse(raw) as Partial<ParsedLead>;

  // Merge with heuristics so we never lose a phone/email the model missed.
  const h = heuristicParse(text);
  const temp = obj.temperature;
  return {
    fullName: obj.fullName ?? h.fullName,
    phone: obj.phone ?? h.phone,
    email: obj.email ?? h.email,
    company: obj.company ?? h.company,
    productInterest: obj.productInterest ?? h.productInterest,
    notes: obj.notes ?? h.notes,
    temperature: temp === "hot" || temp === "warm" || temp === "cold" ? temp : h.temperature,
  };
}

// ── Heuristic fallback ──────────────────────────────────────
const HOT = ["דחוף", "בהקדם", "היום", "עכשיו", "מחיר", "הצעת מחיר", "לקנות", "להזמין", "מעוניין"];
const WARM = ["מעוניין", "אשמח", "פרטים", "לשמוע", "פגישה", "ליצור קשר"];
const NAME_HINT =
  /(?:מדברת|מדבר|קוראים לי|קוראים לו|קוראים לה|שמי|שם|שמו|שמה|לקוח בשם|איש קשר)[:\s-]+([א-ת']{2,15}(?:\s[א-ת']{2,15})?)/;
const NAME_STOP = new Set(["מחברת", "מחברה", "חברת", "חברה", "מ", "של", "את", "מ־", "בע"]);
const COMPANY_HINT = /(?:חברה|חברת|מחברת|ארגון|עסק)[:\s-]+([א-תA-Za-z0-9'"\s.]{2,40})/;
const PRODUCT_HINT = /(?:מעוניין ב|מעוניינת ב|רוצה|צריך|צריכה|מחפש|מחפשת|בנוגע ל|לגבי|בקשר ל)\s*([^.,\n]{2,60})/;

function heuristicParse(text: string): ParsedLead {
  const t = text.toLowerCase();
  const temperature = HOT.some((k) => t.includes(k))
    ? "hot"
    : WARM.some((k) => t.includes(k))
      ? "warm"
      : "cold";

  const nameRaw = text.match(NAME_HINT)?.[1]?.trim() || null;
  // Keep leading name words, stop at the first connector ("מדברת רותי מחברת נובה" → "רותי").
  let name: string | null = null;
  if (nameRaw) {
    const words: string[] = [];
    for (const w of nameRaw.split(/\s+/)) {
      if (NAME_STOP.has(w)) break;
      words.push(w);
      if (words.length === 2) break;
    }
    name = words.join(" ") || null;
  }
  const company = text.match(COMPANY_HINT)?.[1]?.trim() || null;
  const product = text.match(PRODUCT_HINT)?.[1]?.trim() || null;

  return {
    fullName: name,
    phone: extractPhone(text),
    email: extractEmail(text),
    company,
    productInterest: product,
    notes: text.length > 0 ? text.slice(0, 500) : null,
    temperature,
  };
}
