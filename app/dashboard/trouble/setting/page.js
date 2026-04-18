import TroubleUnitSettingsClient from "@/app/dashboard/trouble/setting/trouble-unit-settings-client";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Setting Trouble",
  description: "Master nama unit untuk data trouble",
};

export default async function TroubleSettingPage() {
  const { evaluator } = await requirePagePermission("trouble-setting", "view");

  if (!prisma.troubleUnit?.findMany) {
    return (
      <TroubleUnitSettingsClient
        units={[]}
        initError="Model TroubleUnit belum siap di Prisma Client. Jalankan: npm run prisma:generate && npm run prisma:push"
      />
    );
  }

  const units = await prisma.troubleUnit.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
    },
  });

  return (
    <TroubleUnitSettingsClient
      units={units}
      canCreate={evaluator.canCrud("trouble-setting", "create")}
      canUpdate={evaluator.canCrud("trouble-setting", "update")}
      canDelete={evaluator.canCrud("trouble-setting", "delete")}
    />
  );
}