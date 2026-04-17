import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Detail Sparepart",
  description: "Detail data sparepart",
};

export default async function SparepartDetailPage({ params }) {
  await requireAuthenticatedUser();

  const resolvedParams = await params;
  const sparepartId = String(resolvedParams?.sparepartId || "").trim();

  if (!sparepartId) {
    notFound();
  }

  const sparepart = await prisma.sparepart.findUnique({
    where: { id: sparepartId },
    select: {
      id: true,
      name: true,
      location: true,
      quantity: true,
      description: true,
      images: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          fileName: true,
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!sparepart) {
    notFound();
  }

  const createdAtLabel = new Date(sparepart.createdAt).toLocaleString("id-ID");
  const updatedAtLabel = new Date(sparepart.updatedAt).toLocaleString("id-ID");

  return (
    <div className="space-y-4">
      <div>
        <Link href="/dashboard/sparepart" className="text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900">
          Kembali ke daftar sparepart
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{sparepart.name}</CardTitle>
          <CardDescription>Informasi lengkap sparepart dan galeri gambar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sparepart.images.map((image) => (
              <div key={image.id} className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
                <img src={`/api/dashboard/spareparts/images/${image.id}`} alt={image.fileName || sparepart.name} className="h-56 w-full object-cover" />
              </div>
            ))}
            {sparepart.images.length === 0 ? (
              <div className="flex h-56 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
                Belum ada gambar sparepart
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Nama Sparepart</p>
              <p className="text-sm font-medium text-zinc-900">{sparepart.name}</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Lokasi</p>
              <p className="text-sm font-medium text-zinc-900">{sparepart.location}</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Jumlah Barang</p>
              <p className="text-sm font-medium text-zinc-900">{sparepart.quantity}</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Total Gambar</p>
              <p className="text-sm font-medium text-zinc-900">{sparepart.images.length}</p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Deskripsi</p>
            <p className="text-sm text-zinc-900">{sparepart.description || "-"}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Dibuat</p>
              <p className="text-sm text-zinc-900">{createdAtLabel}</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Diperbarui</p>
              <p className="text-sm text-zinc-900">{updatedAtLabel}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
