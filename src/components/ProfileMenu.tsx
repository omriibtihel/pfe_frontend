import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, LogOut, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { UserProfileDialog } from "@/components/UserProfileDialog";

type Variant = "sidebar" | "inline" | "card";

interface ProfileMenuProps {
  variant: Variant;
  /** Only relevant for variant="sidebar" — controls whether the trigger is expanded */
  sidebarOpen?: boolean;
}

export function ProfileMenu({ variant, sidebarOpen = true }: ProfileMenuProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return stored === "dark" || (!stored && prefersDark);
  });

  // Sync if another tab/instance changes the theme via localStorage
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "theme") setIsDark(e.newValue === "dark");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle("dark", newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const menuItems = (
    <>
      <DropdownMenuLabel className="font-normal">
        <p className="font-semibold">{user?.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="focus:bg-transparent cursor-default p-0">
        <div className="flex w-full items-center justify-between px-2 py-1.5">
          <span className="relative h-5 overflow-hidden text-sm">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isDark ? "dark" : "light"}
                className="block"
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                {isDark ? t("nav.darkMode") : t("nav.lightMode")}
              </motion.span>
            </AnimatePresence>
          </span>
          <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
        </div>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="focus:bg-transparent cursor-default p-0">
        <div className="w-full px-2 py-1.5">
          <LanguageSwitcher variant="pill" />
        </div>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => setProfileOpen(true)}>
        <User className="mr-2 h-4 w-4" />
        {t("nav.profile")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
        <LogOut className="mr-2 h-4 w-4" />
        {t("nav.logout")}
      </DropdownMenuItem>
    </>
  );

  let trigger: React.ReactNode;
  let contentSide: "top" | "bottom" = "bottom";
  let contentAlign: "start" | "end" = "end";

  if (variant === "sidebar") {
    contentSide = "top";
    contentAlign = "start";
    trigger = (
      <button
        className={cn(
          "group w-full cursor-pointer rounded-xl border border-border/60 bg-card/70 p-3",
          "flex items-center gap-3 transition-all duration-300 hover:bg-card",
          !sidebarOpen && "justify-center p-2"
        )}
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl ring-2 ring-primary/10 transition-all group-hover:ring-primary/35">
          {user?.profilePhoto ? (
            <img
              src={`http://127.0.0.1:8000${user.profilePhoto}`}
              alt={user.fullName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20">
              <User className="h-4 w-4 text-primary transition-transform group-hover:scale-110" />
            </div>
          )}
        </div>
        {sidebarOpen && (
          <>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-semibold">{user?.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          </>
        )}
      </button>
    );
  } else if (variant === "card") {
    contentSide = "bottom";
    contentAlign = "start";
    trigger = (
      <button
        type="button"
        aria-label={t("nav.profile")}
        className="ai-surface group relative w-full overflow-hidden rounded-2xl bg-card/75 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 sm:rounded-3xl sm:p-5"
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/15 blur-2xl opacity-50 transition-opacity group-hover:opacity-100" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-2 ring-primary/15 transition-all group-hover:ring-primary/40">
            {user?.profilePhoto ? (
              <img
                src={`http://127.0.0.1:8000${user.profilePhoto}`}
                alt={user.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-secondary/25 to-accent/25">
                <User className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold sm:text-base">{user?.fullName ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </button>
    );
  } else {
    // inline
    trigger = (
      <button
        type="button"
        aria-label={t("nav.profile")}
        className="group flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-card/80 shadow-md ring-2 ring-primary/10 backdrop-blur-xl transition-all hover:ring-primary/40"
      >
        {user?.profilePhoto ? (
          <img
            src={`http://127.0.0.1:8000${user.profilePhoto}`}
            alt={user.fullName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20">
            <User className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
          </div>
        )}
      </button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent side={contentSide} align={contentAlign} className="w-56">
          {menuItems}
        </DropdownMenuContent>
      </DropdownMenu>
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

export default ProfileMenu;
