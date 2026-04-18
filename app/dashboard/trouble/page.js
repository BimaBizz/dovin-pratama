import Link from "next/link";

import { requirePagePermission } from "@/lib/permissions";

export const metadata = {
  title: "Trouble",
  description: "Halaman master trouble dan setting unit",
};

const cards = [
  {
    title: "Unit Trouble",
    description: "Kelola data trouble harian per unit, termasuk waktu off/on, durasi, dan keterangan.",
    href: "/dashboard/trouble/unit-trouble",
  },
  {
    title: "Setting",
    description: "Tambahkan atau ubah daftar nama unit yang muncul saat input data trouble.",
    href: "/dashboard/trouble/setting",
  },
];

export default async function TroublePage() {
  await requirePagePermission("trouble-unit", "view");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-500">Trouble</p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-900">Manajemen Trouble</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Pilih halaman untuk mengelola data trouble atau master unit.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="text-lg font-semibold text-zinc-900">{card.title}</h3>
            <p className="mt-2 text-sm text-zinc-600">{card.description}</p>
            <span className="mt-4 inline-flex text-sm font-medium text-zinc-900 underline underline-offset-4">
              Buka halaman
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}