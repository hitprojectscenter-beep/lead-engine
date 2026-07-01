import Dashboard from "@/components/dashboard";
import { ensureSeed } from "@/lib/db/seed";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Populate demo customers + sample leads on first run so the board isn't empty.
  await ensureSeed().catch(() => {});
  return <Dashboard />;
}
