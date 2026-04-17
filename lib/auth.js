import crypto from "node:crypto";

import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "session_token";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function loginWithEmailPassword(email, password) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return { success: false, message: "Email atau password salah." };
  }

  const isPasswordValid = await compare(password, user.passwordHash);

  if (!isPasswordValid) {
    return { success: false, message: "Email atau password salah." };
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return { success: true };
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: hashToken(token),
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!session) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return session;
}

export async function requireAuthenticatedUser() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireSuperuser() {
  const session = await getCurrentSession();

  if (!session || session.user.role !== "SUPERUSER") {
    redirect("/login");
  }

  return session;
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: {
        tokenHash: hashToken(token),
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
