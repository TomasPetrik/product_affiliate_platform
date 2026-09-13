"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Menu } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-1.5" />}>
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initialsFor(displayName)}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">{displayName}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <p className="font-medium">{displayName}</p>
            <p className="text-xs font-normal text-muted-foreground">{user.role}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              void signOutAction();
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
