import type React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export type KpiTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

/**
 * Tone-based accents for KpiCard. The card surface itself stays in the design
 * system (`bg-card`, `border-border`) — only the small accent rule, the icon
 * tile and the value colour vary by tone, keeping the row visually calm.
 */
const _KPI_TONE: Record<KpiTone, { value: string; iconBg: string; iconFg: string; rule: string }> = {
  neutral: {
    value: 'text-foreground',
    iconBg: 'bg-muted',
    iconFg: 'text-muted-foreground',
    rule: 'bg-border',
  },
  primary: {
    value: 'text-primary',
    iconBg: 'bg-primary/10',
    iconFg: 'text-primary',
    rule: 'bg-primary',
  },
  success: {
    value: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    iconFg: 'text-emerald-600 dark:text-emerald-400',
    rule: 'bg-emerald-500',
  },
  warning: {
    value: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/10',
    iconFg: 'text-amber-600 dark:text-amber-400',
    rule: 'bg-amber-500',
  },
  danger: {
    value: 'text-red-600 dark:text-red-400',
    iconBg: 'bg-red-500/10',
    iconFg: 'text-red-600 dark:text-red-400',
    rule: 'bg-red-500',
  },
};

export function KpiCard({
  title,
  value,
  sub,
  tone = 'neutral',
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
  icon?: React.ReactNode;
}) {
  const t = _KPI_TONE[tone];
  return (
    <Card className="relative overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      <span className={`absolute left-0 top-0 h-full w-1 ${t.rule}`} aria-hidden />
      <CardContent className="pt-5 pb-4 pl-6">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
          {icon && (
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.iconBg} ${t.iconFg} shrink-0`}
            >
              {icon}
            </div>
          )}
        </div>
        <p className={`text-2xl font-bold tabular-nums tracking-tight ${t.value}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
