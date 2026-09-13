import type { Metadata } from "next";
import Link from "next/link";
import { Database, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PgAdminButton } from "@/components/admin/pgadmin-button";
import { listDatabaseTables } from "@/server/services/database-browser.service";

export const metadata: Metadata = {
  title: "Database",
};

export default async function AdminDatabasePage() {
  const tables = await listDatabaseTables();
  const totalRows = tables.reduce((sum, table) => sum + table.rowCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Database</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only view of the live Postgres tables used by this app ({totalRows} rows across{" "}
          {tables.length} tables). For full SQL and table edits, use pgAdmin.
        </p>
        <div className="mt-3">
          <PgAdminButton />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {tables.map((table) => (
          <Card key={table.key}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-muted p-2">
                  <Table2 className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle className="text-base">{table.label}</CardTitle>
                  <CardDescription>{table.description}</CardDescription>
                </div>
              </div>
              <p className="text-sm font-medium tabular-nums">{table.rowCount}</p>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/admin/database/${table.key}`} />}
              >
                <Database className="h-4 w-4" />
                Open table
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
