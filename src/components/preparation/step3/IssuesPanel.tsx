import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Step3Issue } from "@/utils/step3Validation";

interface IssuesPanelProps {
  counts: {
    errors: number;
    warnings: number;
  };
  issues: (Step3Issue & { column?: string })[];
  isValidating: boolean;
  lastValidatedAt: string | null;
  validationError: string | null;
  onIssueClick: (column: string) => void;
}

export function IssuesPanel({
  counts,
  issues,
  isValidating,
  lastValidatedAt,
  validationError,
  onIssueClick,
}: IssuesPanelProps) {
  const { t } = useTranslation();
  const [showAllIssues, setShowAllIssues] = useState(false);

  if (!isValidating && counts.errors === 0 && !validationError) {
    return null;
  }

  const formatValidatedAt = (value: string | null): string => {
    if (!value) return t("preparation.columns.neverValidated");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("preparation.columns.validated");
    return t("preparation.columns.validatedAt", { time: date.toLocaleTimeString() });
  };
  const visibleIssues = useMemo(
    () => (showAllIssues ? issues : issues.slice(0, 8)),
    [issues, showAllIssues]
  );

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" />
          {t("preparation.columns.issuesTitle")}
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={counts.errors > 0 ? "destructive" : "secondary"} className="text-xs">
              {t("preparation.columns.errors", { n: counts.errors })}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {t("preparation.columns.warnings", { n: counts.warnings })}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {isValidating && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("preparation.columns.validating")}
            </span>
          )}
          {!isValidating && <span>{formatValidatedAt(lastValidatedAt)}</span>}
        </div>

        {!!validationError && (
          <div className="rounded-md border border-amber-300/60 bg-amber-50/60 p-2 text-xs text-amber-800">
            {validationError}
          </div>
        )}

        {issues.length > 0 ? (
          <div className="rounded-md border border-border/60 p-2">
            <div className="max-h-44 overflow-auto space-y-1">
              {visibleIssues.map((issue) => (
                <div key={issue.id} className="text-xs">
                  {issue.column ? (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-left text-xs"
                      onClick={() => onIssueClick(issue.column!)}
                    >
                      [{issue.severity === "error" ? t("preparation.columns.severityErr") : t("preparation.columns.severityWarn")}] [{issue.column}] {issue.message}
                    </Button>
                  ) : (
                    <p className={issue.severity === "error" ? "text-destructive" : "text-amber-700"}>
                      [{issue.severity === "error" ? t("preparation.columns.severityErr") : t("preparation.columns.severityWarn")}] {issue.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {issues.length > 8 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-7 px-2 text-xs"
                onClick={() => setShowAllIssues((prev) => !prev)}
              >
                {showAllIssues ? t("preparation.columns.showFewer") : t("preparation.columns.showAll", { n: issues.length })}
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border border-emerald-300/40 bg-emerald-50/30 p-2 text-xs text-emerald-700">
            {t("preparation.columns.noIssues")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default IssuesPanel;
