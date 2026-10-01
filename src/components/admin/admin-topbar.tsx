"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Menu } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { signOutAction } from "@/server/actions/auth.actions";
import type { SessionPayload } from "@/lib/session";

function initialsFor(nameOrEmail: string): string {
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

interface AdminTopbarProps {
  user: SessionPayload;
}

/** Top bar shown on every authenticated admin page. */
export function AdminTopbar({ user }: AdminTopbarProps) {
  const [open, setOpen] = useState(false);
  const displayName = user.name || user.email;

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-4">
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          </SheetHeader>
          <AdminSidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open admin menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      <Link href="/" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
        View public site
      </Link>

      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initialsFor(displayName)}</AvatarFallback>
        </Avatar>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-medium leading-none">{displayName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{user.role}</p>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm" className="gap-1.5">
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
