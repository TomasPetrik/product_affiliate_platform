import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Compass } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoginForm } from "@/components/admin/login-form";
import { getAdminSession } from "@/lib/auth";
import { SITE_NAME_ADMIN } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Admin sign in",
};

interface AdminLoginPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const session = await getAdminSession();

  if (session) {
    redirect("/admin");
  }

  const { from } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="flex items-center gap-2 font-semibold">
            <Compass className="h-5 w-5 text-primary" aria-hidden="true" />
            {SITE_NAME_ADMIN}
          </div>
          <CardTitle className="text-lg">Sign in</CardTitle>
          <CardDescription>Use your admin credentials to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm from={from} />
        </CardContent>
      </Card>
    </div>
  );
}
