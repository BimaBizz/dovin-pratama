import TroubleRecordsClient from "@/app/dashboard/trouble/unit-trouble/trouble-records-client";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Unit Trouble",
  description: "CRUD data trouble per unit",
};

const PAGE_SIZE = 10;

function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function getMonthRange(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

function buildSearchFilter(search) {
  if (!search) {
    return {};
  }

  return {
    OR: [
      { note: { contains: search } },
      { unit: { is: { name: { contains: search } } } },
    ],
  };
}

function buildWhere(search, month) {
  const monthRange = getMonthRange(month);
  const searchFilter = search ? buildSearchFilter(search) : null;

  if (!monthRange) {
    return searchFilter || {};
  }

  const filters = [
    {
      troubleDate: {
        gte: monthRange.start,
        lt: monthRange.end,
      },
    },
  ];

  if (searchFilter) {
    filters.push(searchFilter);
  }

  return filters.length === 1 ? filters[0] : { AND: filters };
}

function serializeRecord(record) {
  return {
    id: record.id,
    unitId: record.unitId,
    troubleDate: record.troubleDate.toISOString(),
    timeOff: record.timeOff,
    timeOn: record.timeOn,
    durationMinutes: record.durationMinutes,
    note: record.note,
    unit: record.unit,
  };
}

export default async function TroubleUnitPage({ searchParams }) {
  const { evaluator } = await requirePagePermission("trouble-unit", "view");

  const resolvedSearchParams = await searchParams;
  const search = String(resolvedSearchParams?.search || "").trim();
  const month = String(resolvedSearchParams?.month || getCurrentMonthKey()).trim();
  const page = Math.max(Number(resolvedSearchParams?.page || 1) || 1, 1);
  const where = buildWhere(search, month);

  if (!prisma.troubleRecord?.findMany || !prisma.troubleUnit?.findMany) {
    return (
      <TroubleRecordsClient
        records={[]}
        unitOptions={[]}
        initError="Model TroubleRecord atau TroubleUnit belum siap di Prisma Client. Jalankan: npm run prisma:generate && npm run prisma:push"
        pagination={{ currentPage: 1, totalPages: 1, totalRecords: 0, pageSize: PAGE_SIZE }}
        month={month}
      />
    );
  }

  const totalRecords = await prisma.troubleRecord.count({ where });
  const totalPages = Math.max(Math.ceil(totalRecords / PAGE_SIZE), 1);
  const currentPage = Math.min(page, totalPages);

  const [records, units] = await Promise.all([
    prisma.troubleRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        unitId: true,
        troubleDate: true,
        timeOff: true,
        timeOn: true,
        durationMinutes: true,
        note: true,
        unit: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.troubleUnit.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return (
    <TroubleRecordsClient
      records={records.map(serializeRecord)}
      unitOptions={units}
      canCreate={evaluator.canCrud("trouble-unit", "create")}
      canUpdate={evaluator.canCrud("trouble-unit", "update")}
      canDelete={evaluator.canCrud("trouble-unit", "delete")}
      pagination={{
        currentPage,
        totalPages,
        totalRecords,
        pageSize: PAGE_SIZE,
      }}
      search={search}
      month={month}
    />
  );
}