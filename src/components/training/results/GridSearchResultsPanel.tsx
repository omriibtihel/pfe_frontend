import { Grid3X3, Shuffle, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { ModelResult } from '@/types';
import { fmtMetric } from './CvResultsPanel';

interface GridSearchResultsPanelProps {
  gridSearch: NonNullable<ModelResult['gridSearch']>;
  hyperparams?: ModelResult['hyperparams'];
}

export function GridSearchResultsPanel({
  gridSearch,
  hyperparams,
}: GridSearchResultsPanelProps) {
  const bestParams = hyperparams?.best ?? gridSearch.bestParams ?? null;
  const paramGrid = hyperparams?.param_grid ?? null;
  const bestScore = gridSearch.cvBestScore;
  const scoring = gridSearch.cvScoring;
  const nSplits = gridSearch.cvSplits;
  const isRandom = gridSearch.searchType === 'random';
  const nCandidates = gridSearch.nCandidates;

  const combinationCount = !isRandom && paramGrid
    ? Object.values(paramGrid).reduce<number>((acc, v) => acc * (Array.isArray(v) ? v.length : 1), 1)
    : 0;

  const regionLabel = isRandom ? 'Résultats RandomizedSearch' : 'Résultats GridSearch';
  const title = isRandom ? 'Optimisation RandomizedSearch CV' : 'Optimisation GridSearch CV';
  const badge = isRandom ? 'RS' : 'GS';

  return (
    <div
      className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3"
      role="region"
      aria-label={regionLabel}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {isRandom
          ? <Shuffle className="h-4 w-4 text-primary" aria-hidden="true" />
          : <Grid3X3 className="h-4 w-4 text-primary" aria-hidden="true" />
        }
        <span className="text-sm font-medium">{title}</span>
        <Badge variant="secondary" className="text-xs">
          {badge}
        </Badge>
        {nSplits != null && (
          <Badge variant="outline" className="text-xs">
            {nSplits} folds
          </Badge>
        )}
        {isRandom && nCandidates != null && (
          <Badge variant="outline" className="text-xs">
            {nCandidates} itérations
          </Badge>
        )}
      </div>

      {bestScore != null && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div>
            <p className="text-[11px] text-muted-foreground">
              Meilleur score CV{scoring && scoring !== 'auto' ? ` (${scoring})` : ''}
            </p>
            <p className="text-2xl font-bold text-primary">{fmtMetric(bestScore)}</p>
          </div>
          <Sparkles className="ml-auto h-5 w-5 text-primary opacity-60" aria-hidden="true" />
        </div>
      )}

      {bestParams != null && Object.keys(bestParams).length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Meilleurs hyperparamètres
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(bestParams).map(([k, v]) => (
              <div key={k} className="rounded-md border border-border/60 bg-background px-2.5 py-1.5">
                <p className="truncate text-[10px] text-muted-foreground">{k}</p>
                <p className="truncate text-xs font-semibold">{String(v ?? '—')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {gridSearch.cvResultsSummary != null && gridSearch.cvResultsSummary.length > 0 && (
        <details className="group">
          <summary className="list-none cursor-pointer select-none text-xs text-muted-foreground transition-colors hover:text-foreground flex items-center gap-1.5">
            <span
              className="inline-block transition-transform group-open:rotate-90"
              aria-hidden="true"
            >
              ›
            </span>
            Top candidats ({gridSearch.cvResultsSummary.length})
          </summary>
          <div className="mt-1.5 space-y-1">
            {gridSearch.cvResultsSummary.map((candidate, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5"
              >
                <span className="w-4 shrink-0 text-[10px] text-muted-foreground">#{i + 1}</span>
                <span className="w-14 shrink-0 text-xs font-semibold text-primary">
                  {fmtMetric(candidate.mean_score)}
                </span>
                <span className="truncate font-mono text-[10px] text-muted-foreground">
                  {Object.entries(candidate.params)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(' | ')}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {!isRandom && paramGrid != null && Object.keys(paramGrid).length > 0 && (
        <details className="group">
          <summary className="list-none cursor-pointer select-none text-xs text-muted-foreground transition-colors hover:text-foreground flex items-center gap-1.5">
            <span
              className="inline-block transition-transform group-open:rotate-90"
              aria-hidden="true"
            >
              ›
            </span>
            Grille explorée ({combinationCount} combinaison{combinationCount > 1 ? 's' : ''})
          </summary>
          <pre className="mt-1.5 max-h-32 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-2.5 text-[10px] font-mono">
            {JSON.stringify(paramGrid, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
