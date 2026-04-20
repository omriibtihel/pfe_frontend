import { Calendar, Hash, Info, Type } from 'lucide-react';

import type { ColKind } from './types';

export function KindIcon({ kind }: { kind: ColKind }) {
  const cls = 'h-4 w-4 flex-shrink-0';
  if (kind === 'numeric') return <Hash className={`${cls} text-blue-500`} />;
  if (kind === 'categorical') return <Type className={`${cls} text-purple-500`} />;
  if (kind === 'text') return <Type className={`${cls} text-teal-500`} />;
  if (kind === 'datetime') return <Calendar className={`${cls} text-amber-500`} />;
  return <Info className={`${cls} text-muted-foreground`} />;
}
