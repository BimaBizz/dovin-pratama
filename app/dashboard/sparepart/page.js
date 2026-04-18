import SparepartCardClient from "@/app/dashboard/sparepart/sparepart-card-client";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Sparepart",
  description: "CRUD data sparepart dalam tampilan card",
};

const PAGE_SIZE = 6;

function buildSearchFilter(search) {
  if (!search) {
    return {};
  }

  return {
    OR: [
      { name: { contains: search } },
      { location: { contains: search } },
      { description: { contains: search } },
    ],
  };
}

export default async function SparepartPage({ searchParams }) {
  const { evaluator } = await requirePagePermission("sparepart", "view");

  const resolvedSearchParams = await searchParams;
  const search = String(resolvedSearchParams?.search || "").trim();
  const page = Math.max(Number(resolvedSearchParams?.page || 1) || 1, 1);
  const where = buildSearchFilter(search);

  if (!prisma.sparepart?.findMany) {
    return (
      <SparepartCardClient
        spareparts={[]}
        search={search}
        pagination={{
          currentPage: 1,
          totalPages: 1,
          totalSpareparts: 0,
          pageSize: PAGE_SIZE,
        }}
        initError="Model sparepart belum siap. Jalankan: npm run prisma:generate && npm run prisma:push"
      />
    );
  }

  const totalSpareparts = await prisma.sparepart.count({ where });
  const totalPages = Math.max(Math.ceil(totalSpareparts / PAGE_SIZE), 1);
  const currentPage = Math.min(page, totalPages);

  const spareparts = await prisma.sparepart.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
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

  return (
    <SparepartCardClient
      spareparts={normalizedSpareparts}
      search={search}
      pagination={{
        currentPage,
        totalPages,
        totalSpareparts,
        pageSize: PAGE_SIZE,
      }}
      canCreate={evaluator.canCrud("sparepart", "create")}
      canUpdate={evaluator.canCrud("sparepart", "update")}
      canDelete={evaluator.canCrud("sparepart", "delete")}
    />
  );
}
