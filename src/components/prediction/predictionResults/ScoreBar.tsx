import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CONF_BADGE, _confLevel, _confTooltip } from './helpers';

export function ScoreBar({ score, threshold = 0.5 }: { score: number | null; threshold?: number }) {
  if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
  const level = _confLevel(score, threshold);
  const style = CONF_BADGE[level];
  const pct = Math.round(score * 100);
  const tPct = Math.round(threshold * 100);
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-2.5 min-w-[140px]">
        <div className="relative h-2 w-24 rounded-full bg-muted overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${pct}%`, backgroundColor: style.bar }}
          />
          <div className="absolute inset-y-0 w-px bg-foreground/30" style={{ left: `${tPct}%` }} />
        </div>
        <span className="text-xs tabular-nums font-semibold" style={{ color: style.bar }}>
          {pct}%
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`cursor-default rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${style.badge}`}
            >
              {style.label}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] text-center text-xs">
            {_confTooltip(level, threshold)}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
