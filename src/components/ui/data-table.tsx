import { ReactNode, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: keyof T | string;
  header: ReactNode; // ✅ was string
  render?: (item: T) => ReactNode;
  className?: string;

  // ✅ optional: clickable header
  onHeaderClick?: () => void;
  headerClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  className?: string;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  pageSize = 10,
  className,
  emptyMessage = "Aucune donnée disponible",
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  // ✅ if data changes, keep page valid
  useEffect(() => {
    setCurrentPage(1);
  }, [data, pageSize]);

  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentData = data.slice(startIndex, endIndex);

  const getValue = (item: T, key: string): unknown => {
    const keys = key.split(".");
    let value: unknown = item;
    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k];
    }
    return value;
  };

  if (data.length === 0) {
    return (
      <div className={cn("bg-card rounded-xl border border-border p-8 text-center", className)}>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-xl border border-border overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {columns.map((column, index) => {
                const clickable = typeof column.onHeaderClick === "function";

                return (
                  <th
                    key={index}
                    onClick={clickable ? column.onHeaderClick : undefined}
                    title={clickable ? "Cliquer pour voir le profil" : undefined}
                    className={cn(
                      "px-4 py-3 text-left text-sm font-semibold text-foreground",
                      clickable && "cursor-pointer select-none hover:bg-muted/70 transition-colors",
                      column.className,
                      column.headerClassName
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {column.header}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {currentData.map((item, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-muted/30 transition-colors">
                {columns.map((column, colIndex) => (
                  <td
                    key={colIndex}
                    className={cn("px-4 py-3 text-sm text-foreground", column.className)}
                  >
                    {column.render ? column.render(item) : String(getValue(item, column.key as string) ?? "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Affichage {startIndex + 1}-{Math.min(endIndex, data.length)} sur {data.length}
          </p>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="px-3 text-sm">
              {currentPage} / {totalPages}
            </span>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
