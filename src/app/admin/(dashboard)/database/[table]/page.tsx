import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getDatabaseTablePage,
  isDatabaseTableKey,
} from "@/server/services/database-browser.service";

interface DatabaseTablePageProps {
  params: Promise<{ table: string }>;
}

export async function generateMetadata({ params }: DatabaseTablePageProps): Promise<Metadata> {
  const { table } = await params;
  if (!isDatabaseTableKey(table)) {
    return { title: "Table not found" };
  }

  const page = await getDatabaseTablePage(table);
  return { title: `${page.label} · Database` };
}

export default async function AdminDatabaseTablePage({ params }: DatabaseTablePageProps) {
  const { table } = await params;

  if (!isDatabaseTableKey(table)) {
    notFound();
  }

  const page = await getDatabaseTablePage(table);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2"
          nativeButton={false}
          render={<Link href="/admin/database" />}
        >
          <ArrowLeft className="h-4 w-4" />
          All tables
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{page.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {page.description}. Showing {page.rows.length} of {page.rowCount} rows.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {page.columns.map((column) => (
                <TableHead key={column} className="whitespace-nowrap font-mono text-xs">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.rows.map((row, index) => (
              <TableRow key={row.id ?? String(index)}>
                {page.columns.map((column) => (
                  <TableCell
                    key={column}
                    className="max-w-xs truncate font-mono text-xs text-muted-foreground"
                    title={row[column]}
                  >
                    {row[column] || "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {page.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={Math.max(page.columns.length, 1)} className="py-10 text-center text-muted-foreground">
                  This table is empty.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
