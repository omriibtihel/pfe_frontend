import React from "react";
import { BarChart3 } from "lucide-react";

export function EmptyChart({ message, icon }: { message: string; icon?: React.ReactNode }) {
  if (!message) return <div className="h-[420px]" />;
  return (
    <div className="h-[420px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
      {icon ?? <BarChart3 className="h-10 w-10 opacity-20" />}
      <p className="text-sm text-center max-w-xs">{message}</p>
    </div>
  );
}
