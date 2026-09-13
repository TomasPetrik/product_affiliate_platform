"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

/**
 * Top bar shown on every admin page. Hosts the mobile nav trigger
 * (persistent sidebar is desktop-only) and a placeholder account menu —
 * real session/user info arrives with admin authentication (Phase 2).
 */
export function AdminTopbar() {
  const [open, setOpen] = useState(false);

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

      <Avatar className="h-8 w-8">
        <AvatarFallback>AD</AvatarFallback>
      </Avatar>
    </header>
  );
}
