"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChartColumnIncreasing,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
  Network,
  Package,
} from "lucide-react";

import { logoutAction } from "@/app/dashboard/actions";
import sidebarLinks from "@/app/dashboard/sidebar-links.json";
import { Button } from "@/components/ui/button";

const iconMap = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  settings: Settings,
  "network": Network,
  "package": Package,
  "chart-column-increasing": ChartColumnIncreasing,
};

export default function MobileSidebar({ displayName }) {
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState(() =>
    sidebarLinks
      .filter((item) => item.type === "group")
      .reduce((accumulator, item, index) => {
        accumulator[item.id] = index === 0;
        return accumulator;
      }, {})
  );

  return (
    <div className="md:hidden">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Buka sidebar"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            className="h-full flex-1 bg-zinc-950/50"
            aria-label="Tutup sidebar"
            onClick={() => setOpen(false)}
          />

          <aside className="absolute left-0 top-0 h-full w-72 border-l border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Control Panel</p>
                <h2 className="mt-1 text-base font-semibold text-zinc-900">Dovin Dashboard</h2>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="space-y-1 p-3 text-sm">
              {sidebarLinks.map((item) => {
                const ItemIcon = iconMap[item.icon] || Settings;

                if (item.type === "link") {
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-zinc-700 transition hover:bg-zinc-100"
                    >
                      <ItemIcon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                }

                if (item.type === "group") {
                  return (
                    <div key={item.id} className="rounded-md border border-zinc-200">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-zinc-700"
                        onClick={() =>
                          setOpenGroups((previous) => ({
                            ...previous,
                            [item.id]: !previous[item.id],
                          }))
                        }
                      >
                        <span className="flex items-center gap-2">
                          <ItemIcon className="h-4 w-4" />
                          {item.label}
                        </span>
                        <ChevronDown className={`h-4 w-4 transition ${openGroups[item.id] ? "rotate-180" : ""}`} />
                      </button>

                      {openGroups[item.id] ? (
                        <div className="border-t border-zinc-200 p-2">
                          {item.links.map((subItem) => (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              onClick={() => setOpen(false)}
                              className="mt-1 block rounded-md px-2 py-1.5 text-zinc-600 transition hover:bg-zinc-100"
                            >
                              {subItem.label}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <div key={item.id} className="flex items-center gap-2 rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-100">
                    <ItemIcon className="h-4 w-4" />
                    {item.label}
                  </div>
                );
              })}
            </nav>

            <div className="mt-4 border-t border-zinc-200 p-4">
              <div className="mb-3 rounded-md bg-zinc-100 p-3">
                <p className="text-xs text-zinc-500">Signed in as</p>
                <p className="truncate text-sm font-medium text-zinc-800">{displayName}</p>
              </div>
              <form action={logoutAction}>
                <Button variant="outline" className="w-full" type="submit">
                  <LogOut />
                  Logout
                </Button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
