import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Step3StatusFilter, Step3TypeFilter } from './types';

const STATUS_FILTER_KEYS: Array<{ value: Step3StatusFilter; tk: string }> = [
  { value: 'all', tk: 'preparation.columns.statusAll' },
  { value: 'active', tk: 'preparation.columns.statusActive' },
  { value: 'dropped', tk: 'preparation.columns.statusDropped' },
  { value: 'errors', tk: 'preparation.columns.statusErrors' },
  { value: 'warnings', tk: 'preparation.columns.statusWarnings' },
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
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full lg:flex-1 lg:min-w-[280px]">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('preparation.columns.filterSearchPlaceholder')}
            className="pl-8"
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => onTypeFilterChange(v as Step3TypeFilter)}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder={t('preparation.columns.filterTypePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('preparation.columns.filterAllTypes')}</SelectItem>
            <SelectItem value="numeric">{t('preparation.columns.filterNumeric')}</SelectItem>
            <SelectItem value="categorical">{t('preparation.columns.filterCategorical')}</SelectItem>
            <SelectItem value="ordinal">{t('preparation.columns.filterOrdinal')}</SelectItem>
            <SelectItem value="auto">{t('preparation.columns.filterAuto')}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!hasActiveFilters}
          onClick={onResetFilters}
        >
          {t('preparation.columns.filterReset')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {STATUS_FILTER_KEYS.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={statusFilter === item.value ? 'secondary' : 'ghost'}
            onClick={() => onStatusFilterChange(item.value)}
            className="gap-1.5"
          >
            {t(item.tk)}
            <Badge variant="outline" className="text-[10px] px-1 py-0 leading-4">
              {statusFilterCounts[item.value]}
            </Badge>
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {t('preparation.columns.shown', { filtered: filteredCount, total: totalCount })}
        {filteredSelectedCount > 0 && t('preparation.columns.selectedExtra', { n: filteredSelectedCount })}
      </p>
    </div>
  );
}
