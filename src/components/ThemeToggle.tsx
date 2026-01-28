import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = stored === 'dark' || (!stored && prefersDark);
    setIsDark(dark);
    root.classList.toggle('dark', dark);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const newDark = !isDark;
    setIsDark(newDark);
    root.classList.toggle('dark', newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  };

  return (
    <Button
      variant="ghost"
      size={collapsed ? "icon" : "default"}
      onClick={toggleTheme}
      className={cn(
        "relative overflow-hidden rounded-xl transition-all duration-300",
        "hover:bg-primary/10 hover:text-primary",
        collapsed ? "w-10 h-10" : "w-full justify-start gap-3 px-4"
      )}
    >
      <div className="relative w-5 h-5">
        <Sun className={cn(
          "h-5 w-5 absolute inset-0 transition-all duration-500",
          isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
        )} />
        <Moon className={cn(
          "h-5 w-5 absolute inset-0 transition-all duration-500",
          isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
        )} />
      </div>
      {!collapsed && (
        <span className="font-medium">
          {isDark ? 'Mode sombre' : 'Mode clair'}
        </span>
      )}
    </Button>
  );
}

export default ThemeToggle;
