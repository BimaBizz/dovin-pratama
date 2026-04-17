import SparepartCardClient from "@/app/dashboard/sparepart/sparepart-card-client";
import { requireAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Sparepart",
  description: "CRUD data sparepart dalam tampilan card",
};

export default async function SparepartPage() {
  await requireAuthenticatedUser();

  if (!prisma.sparepart?.findMany) {
    return <SparepartCardClient spareparts={[]} initError="Model sparepart belum siap. Jalankan: npm run prisma:generate && npm run prisma:push" />;
  }

  const spareparts = await prisma.sparepart.findMany({
    orderBy: {
      createdAt: "desc",
    },
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
    },
  });

  const normalizedSpareparts = spareparts.map((sparepart) => ({
    ...sparepart,
    firstImageUrl: sparepart.images[0]?.id ? `/api/dashboard/spareparts/images/${sparepart.images[0].id}` : null,
    imageItems: sparepart.images.map((image) => ({
      id: image.id,
      fileName: image.fileName,
      url: `/api/dashboard/spareparts/images/${image.id}`,
    })),
  }));

  return <SparepartCardClient spareparts={normalizedSpareparts} />;
}
