import { useMemo } from "react";

import type { Step3Issue, Step3IssueBuckets } from "@/utils/step3Validation";
import { createEmptyIssueBuckets } from "@/utils/step3Validation";

type ColumnIssueCounts = {
  errors: number;
  warnings: number;
};

type MergedIssueListItem = Step3Issue & {
  column?: string;
};

type UseColumnIssuesResult = {
  mergedIssues: Step3IssueBuckets;
  counts: {
    errors: number;
    warnings: number;
  };
  columnCounts: Record<string, ColumnIssueCounts>;
  issuesList: MergedIssueListItem[];
};

function mergeBuckets(localIssues: Step3IssueBuckets, serverIssues: Step3IssueBuckets): Step3IssueBuckets {
  const out = createEmptyIssueBuckets();

  const push = (issue: Step3Issue) => {
    if (issue.column) {
      const list = out.columnIssues[issue.column] ?? [];
      if (!list.some((item) => item.id === issue.id)) {
        out.columnIssues[issue.column] = [...list, issue];
      }
      return;
    }
    if (!out.globalIssues.some((item) => item.id === issue.id)) {
      out.globalIssues = [...out.globalIssues, issue];
    }
  };

  for (const bucket of [localIssues, serverIssues]) {
    for (const issue of bucket.globalIssues) push(issue);
    for (const list of Object.values(bucket.columnIssues)) {
      for (const issue of list) push(issue);
    }
  }

  return out;
}

function issueSort(a: MergedIssueListItem, b: MergedIssueListItem): number {
  if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
  const colA = String(a.column ?? "");
  const colB = String(b.column ?? "");
  if (colA !== colB) return colA.localeCompare(colB);
  return a.message.localeCompare(b.message);
}

export function useColumnIssues(
  localIssues?: Step3IssueBuckets | null,
  serverIssues?: Step3IssueBuckets | null
): UseColumnIssuesResult {
  return useMemo(() => {
    const safeLocal = localIssues ?? createEmptyIssueBuckets();
    const safeServer = serverIssues ?? createEmptyIssueBuckets();

    const mergedIssues = mergeBuckets(safeLocal, safeServer);
    const columnCounts: Record<string, ColumnIssueCounts> = {};
    let errors = 0;
    let warnings = 0;

    for (const issue of mergedIssues.globalIssues) {
      if (issue.severity === "error") errors += 1;
      else warnings += 1;
    }

    for (const [column, list] of Object.entries(mergedIssues.columnIssues)) {
      const counts: ColumnIssueCounts = { errors: 0, warnings: 0 };
      for (const issue of list) {
        if (issue.severity === "error") {
          counts.errors += 1;
          errors += 1;
        } else {
          counts.warnings += 1;
          warnings += 1;
        }
      }
      columnCounts[column] = counts;
    }

    const issuesList: MergedIssueListItem[] = [
      ...mergedIssues.globalIssues,
      ...Object.entries(mergedIssues.columnIssues).flatMap(([column, list]) =>
        list.map((issue) => ({
          ...issue,
          column,
        }))
      ),
    ].sort(issueSort);

    return {
      mergedIssues,
      counts: { errors, warnings },
      columnCounts,
      issuesList,
    };
  }, [localIssues, serverIssues]);
}

export default useColumnIssues;
