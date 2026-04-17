import Link from "next/link";
import { ChartColumnIncreasing, LayoutDashboard, Settings, ShieldCheck, Users, Network, Check } from "lucide-react";

import MobileSidebar from "@/app/dashboard/mobile-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/lib/auth";
import { logoutAction } from "@/app/dashboard/actions";
import sidebarLinks from "@/app/dashboard/sidebar-links.json";

const iconMap = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  settings: Settings,
  "network": Network,
  "check": Check,
  "chart-column-increasing": ChartColumnIncreasing,
};

export default async function DashboardLayout({ children }) {
  const session = await requireAuthenticatedUser();
  const displayName = session.user.fullName || "Pengguna";
  const dispalyRole = session.user.role || "User";

  return (
    <main className="min-h-screen bg-zinc-100 md:grid md:grid-cols-[270px_1fr]">
      <aside className="hidden border-r border-zinc-200 bg-white md:flex md:min-h-screen md:flex-col">
        <div className="border-b border-zinc-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Control Panel</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900">Dovin Dashboard</h2>
        </div>

        <nav className="flex-1 space-y-1 p-3 text-sm">
          {sidebarLinks.map((item) => {
            const ItemIcon = iconMap[item.icon] || Settings;

            if (item.type === "link") {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-zinc-700 transition hover:bg-zinc-100"
                >
                  <ItemIcon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            }

            if (item.type === "group") {
              return (
                <details key={item.id} className="rounded-md border border-zinc-200 bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-zinc-700 hover:bg-zinc-100">
                    <span className="flex items-center gap-2">
                      <ItemIcon className="h-4 w-4" />
                      {item.label}
                    </span>
                  </summary>
                  <div className="border-t border-zinc-200 p-2">
                    {item.links.map((subItem) => (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className="mt-1 block rounded-md px-2 py-1.5 text-zinc-600 transition hover:bg-zinc-100"
                      >
                        {subItem.label}
                      </Link>
                    ))}
                  </div>
                </details>
              );
            }

            return (
              <div key={item.id} className="flex items-center gap-2 rounded-md px-3 py-2 text-zinc-400">
                <ItemIcon className="h-4 w-4" />
                {item.label}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-zinc-200 p-4">
          <div className="mb-3 rounded-md bg-zinc-100 p-3">
            <p className="text-xs text-zinc-500">Signed in as</p>
            <p className="truncate text-sm font-medium text-zinc-800">{displayName}</p>
          </div>
          <form action={logoutAction}>
            <Button variant="outline" className="w-full" type="submit">
              Logout
            </Button>
          </form>
        </div>
      </aside>

      <section className="flex min-h-screen flex-col">
        <header className="border-b border-zinc-200 bg-white px-4 py-3 md:px-8">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MobileSidebar displayName={displayName} />
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{dispalyRole} Workspace</p>
                <h1 className="text-lg font-semibold text-zinc-900">Professional Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{session.user.role}</Badge>
              <ShieldCheck className="h-4 w-4 text-zinc-500" />
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8">
          <section className="mx-auto w-full max-w-6xl">{children}</section>
        </div>

        <footer className="border-t border-zinc-200 bg-white px-4 py-3 md:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Dovin Dashboard. All rights reserved.</p>
            <p>This Program Created by <Link href="https://bmdev.web.id" target="_blank" className="text-blue-500 hover:underline">
              BMDev
            </Link></p>
          </div>
        </footer>
      </section>
    </main>
  );
}
