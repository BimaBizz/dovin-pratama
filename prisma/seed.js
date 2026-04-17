const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const defaultPassword = "Password123!";

const superuserEmail = (process.env.SUPERUSER_EMAIL || "").trim().toLowerCase();

function makeProfile(fullName, birthPlace, birthDate, address) {
  return {
    fullName,
    birthPlace,
    birthDate,
    address,
  };
}

const roleSeeds = [
  { name: "SUPERUSER" },
  { name: "SUPERVISOR" },
  { name: "ADMIN" },
  { name: "TEKNISI" },
  { name: "LEADER TEKNISI" },
  { name: "ASS TEKNISI" },
];

const dummyUserSeeds = [
  {
    email: "supervisor@example.com",
    role: "SUPERVISOR",
    ...makeProfile("Andi Pratama", "Bandung", new Date("1991-03-14"), "Jl. Melati No. 12, Bandung"),
  },
  {
    email: "admin@example.com",
    role: "ADMIN",
    ...makeProfile("Siti Rahma", "Jakarta", new Date("1990-07-22"), "Jl. Anggrek No. 8, Jakarta"),
  },
  ...Array.from({ length: 9 }, (_, index) => ({
    email: `teknisi${String(index + 1).padStart(2, "0")}@example.com`,
    role: "TEKNISI",
    ...makeProfile(
      `Teknisi ${index + 1}`,
      index % 2 === 0 ? "Semarang" : "Yogyakarta",
      new Date(1992 + index, (index % 12), 10 + (index % 10)),
      `Jl. Teknisi ${index + 1}, Kota ${index + 1}`
    ),
  })),
  ...Array.from({ length: 3 }, (_, index) => ({
    email: `leader-teknisi${String(index + 1).padStart(2, "0")}@example.com`,
    role: "LEADER TEKNISI",
    ...makeProfile(
      `Leader Teknisi ${index + 1}`,
      index === 0 ? "Surabaya" : "Malang",
      new Date(1988 + index, 1 + index, 5 + index),
      `Jl. Leader ${index + 1}, Kota ${index + 1}`
    ),
  })),
  ...Array.from({ length: 28 }, (_, index) => ({
    email: `ass-teknisi${String(index + 1).padStart(2, "0")}@example.com`,
    role: "ASS TEKNISI",
    ...makeProfile(
      `Asisten Teknisi ${index + 1}`,
      index % 2 === 0 ? "Depok" : "Bekasi",
      new Date(1995 + (index % 5), (index % 12), 1 + (index % 20)),
      `Jl. Asisten ${index + 1}, Blok ${String.fromCharCode(65 + (index % 26))}`
    ),
  })),
];

async function main() {
  if (!superuserEmail) {
    throw new Error("SUPERUSER_EMAIL harus diisi di environment.");
  }

  for (const role of roleSeeds) {
    await prisma.roleEntry.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  const hashedPassword = await bcrypt.hash(process.env.SUPERUSER_PASSWORD || defaultPassword, 12);

  await prisma.user.upsert({
    where: { email: superuserEmail },
    update: {
      fullName: "Superuser",
    birthPlace: "-",
      birthDate: null,
    address: "-",
      passwordHash: hashedPassword,
      role: "SUPERUSER",
    },
    create: {
      email: superuserEmail,
      fullName: "Superuser",
      birthPlace: "-",
      birthDate: null,
      address: "-",
      passwordHash: hashedPassword,
      role: "SUPERUSER",
    },
  });

  await prisma.user.deleteMany({
    where: {
      role: "SUPERUSER",
      NOT: {
        email: superuserEmail,
      },
    },
  });

  for (const user of dummyUserSeeds) {
    const email = user.email.trim().toLowerCase();

    await prisma.user.upsert({
      where: { email },
      update: {
        fullName: user.fullName,
        birthPlace: user.birthPlace,
        birthDate: user.birthDate,
        address: user.address,
        passwordHash: hashedPassword,
        role: user.role,
      },
      create: {
        email,
        fullName: user.fullName,
        birthPlace: user.birthPlace,
        birthDate: user.birthDate,
        address: user.address,
        passwordHash: hashedPassword,
        role: user.role,
      },
    });
  }

  console.log("Seed dummy user selesai:");
  console.log(`- 1 SUPERUSER (${superuserEmail})`);
  console.log("- 1 SUPERVISOR");
  console.log("- 1 ADMIN");
  console.log("- 9 TEKNISI");
  console.log("- 3 LEADER TEKNISI");
  console.log("- 28 ASS TEKNISI");
  console.log(`- password default: ${process.env.SUPERUSER_PASSWORD || defaultPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
