import type { Metadata, Viewport } from "next";
import { Assistant } from "next/font/google";
import Link from "next/link";
import { Radio, LayoutGrid, BarChart3, QrCode, Users, Send } from "lucide-react";
import "./globals.css";

const assistant = Assistant({ subsets: ["hebrew", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "מנוע לידים — Lead Engine",
  description: "קליטה אוטומטית, ניקוד וניהול לידים אומניצ'אנל",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "פתיחת ליד" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#3b6fed",
  width: "device-width",
  initialScale: 1,
  // Allow pinch-zoom (accessibility) + extend under the notch on iOS.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className={assistant.className}>
        <div className="min-h-dvh">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3">
              <Link
                href="/"
                className="flex shrink-0 items-center gap-2 font-bold text-slate-900"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-white">
                  <Radio size={18} />
                </span>
                <span className="hidden sm:inline">מנוע לידים</span>
              </Link>
              {/* Horizontally scrollable on small screens so the nav never overflows. */}
              <nav className="scroll-x -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 text-sm">
                <NavLink href="/" icon={<LayoutGrid size={16} />}>
                  לוח לידים
                </NavLink>
                <NavLink href="/reps" icon={<Users size={16} />}>
                  נציגים
                </NavLink>
                <NavLink href="/campaigns" icon={<Send size={16} />}>
                  מסעות טיפוח
                </NavLink>
                <NavLink href="/analytics" icon={<BarChart3 size={16} />}>
                  אנליטיקה
                </NavLink>
                <NavLink href="/tools" icon={<QrCode size={16} />}>
                  ערוצי קליטה
                </NavLink>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 sm:px-3"
    >
      {icon}
      {children}
    </Link>
  );
}
