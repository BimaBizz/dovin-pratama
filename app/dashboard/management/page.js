import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getPermissionEvaluator } from "@/lib/permissions";

export const metadata = {
  title: "Management",
  description: "Halaman management mengikuti konfigurasi sidebar",
};

export default async function ManagementPage() {
  const session = await requireAuthenticatedUser();
  const evaluator = await getPermissionEvaluator(session.user.role);
  const sidebarLinks = evaluator.getSidebarItems();

  const managementSections = sidebarLinks
    .filter((item) => item.type === "group")
    .map((item) => ({
      ...item,
      links: (item.links || []).filter((link) => link.href.startsWith("/dashboard/management")),
    }))
    .filter((item) => item.links.length > 0);

  if (managementSections.length === 0) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Management</CardTitle>
          <CardDescription>
            Halaman ini otomatis mengikuti data link dari sidebar. Cukup ubah JSON sidebar, menu di sini ikut berubah.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {managementSections.map((section) => (
          <Card key={section.id}>
            <CardContent className="pt-6">
              <details className="group" open={section.id === managementSections[0]?.id}>
                <summary className="cursor-pointer list-none rounded-md border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900 transition group-open:mb-3 group-open:bg-zinc-100">
                  {section.label}
                </summary>

                <p className="mb-3 text-sm text-zinc-500">Daftar menu untuk {section.label}.</p>

                <ul className="space-y-2">
                  {section.links.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="block rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}