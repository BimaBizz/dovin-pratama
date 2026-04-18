import ProfileSettingsClient from "@/app/dashboard/settings/profile-settings-client";
import { requireAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Settings",
  description: "Pengaturan profil akun",
};

function toDateInputValue(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

export default async function SettingsPage() {
  const session = await requireAuthenticatedUser();

  const profile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      fullName: true,
      email: true,
      birthPlace: true,
      birthDate: true,
      address: true,
    },
  });

  if (!profile) {
    return <ProfileSettingsClient profile={null} initError="Profil user tidak ditemukan." />;
  }

  return (
    <ProfileSettingsClient
      profile={{
        ...profile,
        birthDate: toDateInputValue(profile.birthDate),
      }}
    />
  );
}