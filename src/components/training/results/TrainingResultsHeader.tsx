import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  Download,
  FileJson,
  FileText,
  Layers,
  Loader2,
  TestTube,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TrainingSession } from '@/types';

export type ReportDownloadFormat = 'json' | 'pdf';

interface TrainingResultsHeaderProps {
  session: TrainingSession;
  preferredFormat: ReportDownloadFormat;
  downloadingFormat: ReportDownloadFormat | null;
  canDownloadPdf: boolean;
  onDownload: (format: ReportDownloadFormat) => void;
  onBack?: () => void;
}

const STATUS_MAP: Record<
  string,
  {
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    className?: string;
  }
> = {
  queued: { label: 'En attente', variant: 'secondary' },
  running: { label: 'En cours', variant: 'default' },
  succeeded: {
    label: 'Terminé',
    variant: 'outline',
    className: 'border-emerald-500 text-emerald-600 dark:text-emerald-400',
  },
  failed: { label: 'Échoué', variant: 'destructive' },
};

const DOWNLOAD_FORMAT_COPY: Record<
  ReportDownloadFormat,
  {
    shortLabel: string;
    actionLabel: string;
    loadingLabel: string;
    description: string;
    icon: LucideIcon;
  }
> = {
  json: {
    shortLabel: 'JSON',
    actionLabel: 'Télécharger en JSON',
    loadingLabel: 'Téléchargement JSON...',
    description: 'Export brut de la session pour archivage ou reprise.',
    icon: FileJson,
  },
  pdf: {
    shortLabel: 'PDF',
    actionLabel: 'Télécharger en PDF',
    loadingLabel: 'Génération PDF...',
    description: 'Rapport A4 structuré, lisible et prêt à imprimer.',
    icon: FileText,
  },
};

function formatDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDurationSeconds(session: TrainingSession): number | null {
  if (!session.startedAt || !session.completedAt) return null;
  return Math.round(
    (new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000,
  );
}

function getSplitLabel(session: TrainingSession): string {
  const { splitMethod, kFolds } = session.config;
  if (splitMethod === 'kfold') return `K-Fold (k=${kFolds})`;
  if (splitMethod === 'stratified_kfold') return `Stratified K-Fold (k=${kFolds})`;
  return 'Holdout';
}

export function TrainingResultsHeader({
  session,
  preferredFormat,
  downloadingFormat,
  canDownloadPdf,
  onDownload,
  onBack,
}: TrainingResultsHeaderProps) {
  const statusCfg = STATUS_MAP[session.status ?? ''] ?? {
    label: session.status ?? 'inconnu',
    variant: 'outline' as const,
  };
  const duration = getDurationSeconds(session);
  const splitLabel = getSplitLabel(session);
  const completedAt = formatDate(session.completedAt ?? session.createdAt);
  const modelCount = session.results?.length ?? 0;
  const activeFormat = downloadingFormat ?? preferredFormat;
  const isDownloading = downloadingFormat !== null;
  const activeCopy = DOWNLOAD_FORMAT_COPY[activeFormat];
  const mainActionLabel = isDownloading
    ? activeCopy.loadingLabel
    : `Télécharger le rapport (${DOWNLOAD_FORMAT_COPY[preferredFormat].shortLabel})`;

  return (
    <header className="space-y-4" aria-label="En-tête de la session d'entraînement">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          {onBack ? (
            <button
              onClick={onBack}
              className="group mb-2 flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Retour au projet"
            >
              <ArrowLeft
                className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
                aria-hidden="true"
              />
              Retour au projet
            </button>
          ) : null}

          <h1 className="text-2xl font-bold tracking-tight">Résultats d'entraînement</h1>
          <p className="text-sm text-muted-foreground">
            Session&nbsp;#{session.id}
            {completedAt ? <> &middot; {completedAt}</> : null}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant={statusCfg.variant}
            className={statusCfg.className}
            aria-label={`Statut : ${statusCfg.label}`}
          >
            {statusCfg.label}
          </Badge>

          <div className="flex items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownload(preferredFormat)}
              disabled={isDownloading}
              className="rounded-r-none pr-3"
              aria-label={mainActionLabel}
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{mainActionLabel}</span>
              <span className="sm:hidden">
                {`Rapport ${DOWNLOAD_FORMAT_COPY[activeFormat].shortLabel}`}
              </span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-l-none border-l-0 px-2"
                  disabled={isDownloading}
                  aria-label="Choisir le format du rapport"
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Téléchargement du rapport</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DownloadMenuItem
                  format="json"
                  preferredFormat={preferredFormat}
                  downloadingFormat={downloadingFormat}
                  onSelect={onDownload}
                />

                <DownloadMenuItem
                  format="pdf"
                  preferredFormat={preferredFormat}
                  downloadingFormat={downloadingFormat}
                  disabled={!canDownloadPdf}
                  disabledReason="Disponible dès qu'au moins un résultat est présent."
                  onSelect={onDownload}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="list" aria-label="Informations sur la session">
        <MetaChip
          icon={<TestTube className="h-3.5 w-3.5" />}
          label="Tâche"
          value={session.config.taskType === 'regression' ? 'Régression' : 'Classification'}
          role="listitem"
        />
        <MetaChip
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Split"
          value={splitLabel}
          role="listitem"
        />
        <MetaChip
          label="Modèles"
          value={`${modelCount} entraîné${modelCount > 1 ? 's' : ''}`}
          role="listitem"
        />
        {duration != null ? (
          <MetaChip
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Durée"
            value={duration >= 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`}
            role="listitem"
          />
        ) : null}
      </div>
    </header>
  );
}

function MetaChip({
  icon,
  label,
  value,
  role,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  role?: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-md bg-muted/60 px-3 py-1.5 text-sm text-muted-foreground"
      role={role}
    >
      {icon ? (
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
      ) : null}

      <span>
        {label}&nbsp;:{' '}
        <span className="font-medium text-foreground">{value}</span>
      </span>
    </div>
  );
}

function DownloadMenuItem({
  format,
  preferredFormat,
  downloadingFormat,
  disabled = false,
  disabledReason,
  onSelect,
}: {
  format: ReportDownloadFormat;
  preferredFormat: ReportDownloadFormat;
  downloadingFormat: ReportDownloadFormat | null;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: (format: ReportDownloadFormat) => void;
}) {
  const copy = DOWNLOAD_FORMAT_COPY[format];
  const Icon = copy.icon;
  const isPreferred = preferredFormat === format;
  const isDownloading = downloadingFormat === format;

  return (
    <DropdownMenuItem
      onSelect={() => onSelect(format)}
      disabled={disabled || downloadingFormat !== null}
      className="gap-3 py-2"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Icon className="h-4 w-4" aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground">{copy.actionLabel}</div>
        <div className="text-xs leading-relaxed text-muted-foreground">
          {disabled ? disabledReason : copy.description}
        </div>
      </div>

      {isPreferred && !isDownloading ? (
        <DropdownMenuShortcut>Défaut</DropdownMenuShortcut>
      ) : null}
    </DropdownMenuItem>
  );
}
