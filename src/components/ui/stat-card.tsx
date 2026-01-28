import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  iconClassName?: string;
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  className,
  iconClassName 
}: StatCardProps) {
  return (
    <div className={cn(
      "stat-card bg-card rounded-2xl border border-border/50 p-6 shadow-card hover:shadow-premium transition-all duration-500 ease-out group",
      className
    )}>
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-4xl font-bold text-foreground tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-full",
              trend.isPositive 
                ? "text-success bg-success/10" 
                : "text-destructive bg-destructive/10"
            )}>
              <span className="text-xs">{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground font-normal text-xs ml-1">vs mois dernier</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
            "bg-gradient-to-br from-primary/15 to-secondary/10 shadow-sm",
            iconClassName
          )}>
            <Icon className="h-7 w-7 text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;
