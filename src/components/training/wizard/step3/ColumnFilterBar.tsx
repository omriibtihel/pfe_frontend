import { AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Step3StatusFilter, Step3TypeFilter } from './types';

const STATUS_FILTERS: Array<{ value: Step3StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'errors', label: 'With errors' },
  { value: 'warnings', label: 'With warnings' },
];

interface ColumnFilterBarProps {
  searchQuery: string;
  statusFilter: Step3StatusFilter;
  typeFilter: Step3TypeFilter;
  statusFilterCounts: Record<Step3StatusFilter, number>;
  filteredCount: number;
  totalCount: number;
  filteredSelectedCount: number;
  counts: { errors: number; warnings: number };
  hasActiveFilters: boolean;
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (filter: Step3StatusFilter) => void;
  onTypeFilterChange: (filter: Step3TypeFilter) => void;
  onResetFilters: () => void;
}

export function ColumnFilterBar({
  searchQuery,
  statusFilter,
  typeFilter,
  statusFilterCounts,
  filteredCount,
  totalCount,
  filteredSelectedCount,
  counts,
  hasActiveFilters,
  onSearchChange,
  onStatusFilterChange,
  onTypeFilterChange,
  onResetFilters,
}: ColumnFilterBarProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full lg:flex-1 lg:min-w-[280px]">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search columns..."
            className="pl-8"
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => onTypeFilterChange(v as Step3TypeFilter)}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Type: all</SelectItem>
            <SelectItem value="numeric">Type: numeric</SelectItem>
            <SelectItem value="categorical">Type: categorical</SelectItem>
            <SelectItem value="ordinal">Type: ordinal</SelectItem>
            <SelectItem value="auto">Type: auto</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!hasActiveFilters}
          onClick={onResetFilters}
        >
          Reset filters
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {STATUS_FILTERS.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={statusFilter === item.value ? 'secondary' : 'ghost'}
            onClick={() => onStatusFilterChange(item.value)}
            className="gap-1.5"
          >
            {item.label}
            <Badge variant="outline" className="text-[10px] px-1 py-0 leading-4">
              {statusFilterCounts[item.value]}
            </Badge>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="font-normal">
          {filteredCount} / {totalCount} colonne(s) affichee(s)
        </Badge>
        <Badge variant="outline" className="font-normal">
          {filteredSelectedCount} selectionnee(s) dans le filtre courant
        </Badge>
        {counts.errors > 0 ? (
          <Badge variant="destructive" className="font-normal">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {counts.errors} erreur(s)
          </Badge>
        ) : (
          <Badge variant="secondary" className="font-normal">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Aucune erreur bloquante
          </Badge>
        )}
      </div>
    </div>
  );
}
