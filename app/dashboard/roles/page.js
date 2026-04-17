import RolesCrudClient from "@/app/dashboard/roles/roles-crud-client";
import { requireSuperuser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Roles",
  description: "CRUD roles management",
};

export default async function RolesPage() {
  await requireSuperuser();

  const roleDelegate = prisma.roleEntry;

  if (!roleDelegate?.findMany) {
    return (
      <RolesCrudClient
        roles={[]}
        initError="Model role belum siap di Prisma Client. Jalankan: npm run prisma:generate && npm run prisma:push"
      />
    );
  }

  const roles = await roleDelegate.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <RolesCrudClient roles={roles} />;
}
