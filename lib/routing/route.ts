// ─────────────────────────────────────────────────────────────
//  Lead routing engine — decides which rep should own a lead.
//  Priority (first match wins), each with a human-readable reason:
//   1. Account continuity — existing customer keeps their account owner
//   2. Specialty match      — rep whose specialties fit the product
//   3. Region match         — rep covering the lead's region
//   4. Load balancing       — least-loaded active rep (round-robin)
//  Never overloads: a rep at/above capacity is skipped unless everyone is.
// ─────────────────────────────────────────────────────────────
import type { Lead, Rep } from "../types";
import { store } from "../db/store";

export interface RouteDecision {
  repId: string | null;
  repName: string | null;
  reason: string;
}

/** Open-lead count per rep, used for load balancing. */
export async function loadByRep(): Promise<Map<string, number>> {
  const leads = await store.listLeads();
  const load = new Map<string, number>();
  for (const l of leads) {
    if (!l.ownerId) continue;
    if (l.status === "won" || l.status === "lost") continue;
    load.set(l.ownerId, (load.get(l.ownerId) ?? 0) + 1);
  }
  return load;
}

function hasCapacity(rep: Rep, load: Map<string, number>): boolean {
  return (load.get(rep.id) ?? 0) < rep.capacity;
}

function leastLoaded(reps: Rep[], load: Map<string, number>): Rep | null {
  if (!reps.length) return null;
  return [...reps].sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0))[0];
}

export function decideRoute(
  lead: Partial<Lead>,
  reps: Rep[],
  load: Map<string, number>,
  customerOwnerId?: string | null,
): RouteDecision {
  const active = reps.filter((r) => r.active);
  if (!active.length) return { repId: null, repName: null, reason: "אין נציגים פעילים" };

  const name = (id: string | null) => active.find((r) => r.id === id)?.name ?? null;

  // 1. Account continuity — existing customer stays with their owner
  if (customerOwnerId) {
    const owner = active.find((r) => r.id === customerOwnerId);
    if (owner) return { repId: owner.id, repName: owner.name, reason: "המשכיות חשבון — מנהל הלקוח הקיים" };
  }

  // Prefer reps that still have capacity; if all are full, consider everyone.
  const pool = active.some((r) => hasCapacity(r, load))
    ? active.filter((r) => hasCapacity(r, load))
    : active;

  // 2. Specialty match against the product interest
  const interest = (lead.productInterest ?? "").toLowerCase();
  if (interest) {
    const matches = pool.filter((r) =>
      r.specialties.some((s) => s && interest.includes(s.toLowerCase())),
    );
    const pick = leastLoaded(matches, load);
    if (pick) return { repId: pick.id, repName: pick.name, reason: `התאמת התמחות (${pick.specialties.join(", ")})` };
  }

  // 3. Region match against the lead source / region hint
  const hint = `${lead.source ?? ""} ${lead.company ?? ""}`.toLowerCase();
  if (hint.trim()) {
    const matches = pool.filter((r) => r.regions.some((g) => g && hint.includes(g.toLowerCase())));
    const pick = leastLoaded(matches, load);
    if (pick) return { repId: pick.id, repName: pick.name, reason: `התאמת אזור (${pick.regions.join(", ")})` };
  }

  // 4. Load balancing
  const pick = leastLoaded(pool, load);
  return pick
    ? { repId: pick.id, repName: pick.name, reason: "איזון עומסים — הנציג הפנוי ביותר" }
    : { repId: null, repName: name(null), reason: "לא נמצא נציג מתאים" };
}

/** Convenience: load reps + load map and decide in one call. */
export async function routeLead(
  lead: Partial<Lead>,
  customerOwnerId?: string | null,
): Promise<RouteDecision> {
  const [reps, load] = await Promise.all([store.listReps(), loadByRep()]);
  return decideRoute(lead, reps, load, customerOwnerId);
}
