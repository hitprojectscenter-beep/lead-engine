import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { customAlphabet } from "nanoid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);
export const newId = (prefix: string) => `${prefix}_${nano()}`;

/**
 * Normalise an Israeli/int'l phone to a comparable digit string.
 * "052-123-4567" → "972521234567", "+972 52 123 4567" → "972521234567".
 * Returns null if there's nothing phone-like.
 */
export function normalizePhone(input?: string | null): string | null {
  if (!input) return null;
  let d = input.replace(/[^\d+]/g, "");
  if (!d) return null;
  d = d.replace(/^whatsapp:/i, "");
  if (d.startsWith("+")) d = d.slice(1);
  // Local Israeli 0XXXXXXXXX → 972XXXXXXXXX
  if (d.startsWith("0")) d = "972" + d.slice(1);
  // Bare 9-digit Israeli mobile without leading 0 (e.g. 52...) → assume IL
  if (d.length === 9 && (d.startsWith("5") || d.startsWith("7"))) d = "972" + d;
  return d.length >= 7 ? d : null;
}

export function normalizeEmail(input?: string | null): string | null {
  if (!input) return null;
  const e = input.trim().toLowerCase();
  return /.+@.+\..+/.test(e) ? e : null;
}

/** Extract the first phone-like token from free text. */
export function extractPhone(text: string): string | null {
  const m = text.match(/(\+?\d[\d\s\-().]{6,}\d)/);
  return m ? normalizePhone(m[1]) : null;
}

/** Extract the first email from free text. */
export function extractEmail(text: string): string | null {
  const m = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? normalizeEmail(m[0]) : null;
}

export function formatDateTime(iso: string, locale = "he-IL"): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.floor(h / 24);
  return `לפני ${d} ימים`;
}
