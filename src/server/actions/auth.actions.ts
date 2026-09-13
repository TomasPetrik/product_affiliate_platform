"use server";

import { redirect } from "next/navigation";

import { createAdminSession, destroyAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/server/validations/auth.schema";

export interface LoginActionState {
  error?: string;
}

/**
 * Credentials login. Intentionally returns a generic error for both
 * "no such user" and "wrong password" — never reveal which one it was.
 */
export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email, password } = parsed.data;
  const genericError = { error: "Invalid email or password." };

  const user = await prisma.adminUser.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    return genericError;
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    return genericError;
  }

  await createAdminSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const from = formData.get("from");
  redirect(typeof from === "string" && from.startsWith("/admin") ? from : "/admin");
}

export async function signOutAction(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}
