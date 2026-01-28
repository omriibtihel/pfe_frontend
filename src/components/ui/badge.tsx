import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-primary hover:bg-primary/25 shadow-sm",
        secondary: "border-transparent bg-secondary/15 text-secondary hover:bg-secondary/25 shadow-sm",
        destructive: "border-transparent bg-destructive/15 text-destructive hover:bg-destructive/25 shadow-sm",
        outline: "text-foreground border-border/50 hover:border-primary/30 hover:bg-primary/5",
        success: "border-transparent bg-success/15 text-success hover:bg-success/25 shadow-sm",
        warning: "border-transparent bg-warning/15 text-warning hover:bg-warning/25 shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
