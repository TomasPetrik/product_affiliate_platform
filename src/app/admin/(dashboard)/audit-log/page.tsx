import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAuditLog } from "@/server/services/audit.service";

export const metadata: Metadata = { title: "Audit log" };

const actionVariant: Record<string, "secondary" | "destructive" | "outline"> = {
  PRODUCT_DELETED: "destructive",
  CATEGORY_DELETED: "destructive",
  PRODUCT_PUBLISHED: "secondary",
  PRODUCT_UNPUBLISHED: "outline",
};

export default async function AdminAuditLogPage() {
  const entries = await listAuditLog();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who changed what, and when — read-only trail of every admin mutation (most recent {entries.length}).
        </p>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {entry.createdAt.toLocaleString()}
                </TableCell>
                <TableCell>{entry.actorName ?? entry.actorEmail ?? "System"}</TableCell>
                <TableCell>
                  <Badge variant={actionVariant[entry.action] ?? "outline"}>{entry.action}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {entry.entityType} <span className="font-mono text-xs">{entry.entityId}</span>
                </TableCell>
              </TableRow>
            ))}
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No audit events yet. They&apos;ll appear here as soon as you create, edit or delete
                  something.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
