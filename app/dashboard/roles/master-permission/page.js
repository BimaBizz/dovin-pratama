import { getAccessControlConfig } from "@/lib/access-control-config";
import { requirePagePermission } from "@/lib/permissions";

import MasterPermissionClient from "@/app/dashboard/roles/master-permission/permissions-master-client";

export const metadata = {
  title: "Master Permission",
  description: "Kelola priority role dan visibility/CRUD per halaman",
};

export default async function MasterPermissionPage() {
  const { session, evaluator } = await requirePagePermission("permissions-master", "view");
  const config = await getAccessControlConfig();

  return (
    <MasterPermissionClient
      initialConfig={config}
      canManage={evaluator.isHighestPriority && evaluator.canCrud("permissions-master", "update")}
      viewerRole={session.user.role}
      viewerPriority={evaluator.rolePriority}
      maxPriority={evaluator.maxPriority}
    />
  );
}
