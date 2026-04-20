import { Badge } from '@/components/ui/badge';

export function QualityBadge({ missing, total }: { missing: number; total: number }) {
  const pct = total ? (missing / total) * 100 : 0;
  if (pct === 0)
    return <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-0">Complet</Badge>;
  if (pct < 5)
    return <Badge className="bg-green-500/15 text-green-700 dark:text-green-300 border-0">Bon</Badge>;
  if (pct < 15)
    return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0">Attention</Badge>;
  return <Badge className="bg-destructive/15 text-destructive border-0">Critique</Badge>;
}
