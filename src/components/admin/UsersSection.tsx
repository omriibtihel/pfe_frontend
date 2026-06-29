import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  MapPin,
  Phone,
  Search,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { User } from "@/types";

const API_ORIGIN = "http://127.0.0.1:8000";

export function photoUrl(path?: string): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${API_ORIGIN}${path}`;
}

export function initials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export type SectionAccent = "amber" | "emerald" | "rose";

const ACCENT: Record<SectionAccent, { icon: string; badge: string; bar: string }> = {
  amber: {
    icon: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    bar: "from-amber-500/70 via-amber-400/30",
  },
  emerald: {
    icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    bar: "from-emerald-500/70 via-emerald-400/30",
  },
  rose: {
    icon: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    bar: "from-rose-500/70 via-rose-400/30",
  },
};

function DetailField({
  icon: Icon,
  label,
  value,
  fallback,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  fallback: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={`truncate text-sm ${value ? "font-medium text-foreground" : "italic text-muted-foreground"}`}
          title={value || undefined}
        >
          {value || fallback}
        </p>
      </div>
    </div>
  );
}

function UserIdentity({ user }: { user: User }) {
  const { t } = useTranslation();
  const avatar = photoUrl(user.profilePhoto);
  const isAdmin = user.role === "admin";

  return (
    <div className="flex min-w-0 items-center gap-3">
      {avatar ? (
        <img
          src={avatar}
          alt={user.fullName}
          className="h-11 w-11 shrink-0 rounded-xl border object-cover"
        />
      ) : (
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-muted/70 font-semibold">
          {initials(user.fullName)}
        </span>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-semibold" title={user.fullName}>
            {user.fullName}
          </p>
          {isAdmin && (
            <Badge
              variant="secondary"
              className="shrink-0 rounded-full px-2 py-0 text-[10px]"
            >
              {t("adminDashboard.roleLabel.ADMIN")}
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground" title={user.email}>
          {user.email}
        </p>
      </div>
    </div>
  );
}

function ContactFields({ user }: { user: User }) {
  const { t } = useTranslation();
  const notProvided = t("adminDashboard.detail.notProvided");
  return (
    <>
      <DetailField
        icon={Phone}
        label={t("adminDashboard.detail.phone")}
        value={user.phone}
        fallback={notProvided}
      />
      <DetailField
        icon={MapPin}
        label={t("adminDashboard.detail.establishment")}
        value={user.address || user.hospital}
        fallback={notProvided}
      />
    </>
  );
}

function ProfileFields({ user }: { user: User }) {
  const { t } = useTranslation();
  const notProvided = t("adminDashboard.detail.notProvided");
  return (
    <>
      <DetailField
        icon={Calendar}
        label={t("adminDashboard.detail.dob")}
        value={user.dateOfBirth}
        fallback={notProvided}
      />
      <DetailField
        icon={Stethoscope}
        label={t("adminDashboard.detail.specialty")}
        value={user.specialty}
        fallback={notProvided}
      />
    </>
  );
}

export interface UsersSectionProps {
  accent: SectionAccent;
  icon: LucideIcon;
  title: string;
  hint: string;
  /** Total count shown in the header badge (before filtering). */
  count: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  /** Already-filtered list to render. */
  users: User[];
  loading: boolean;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyHint: string;
  /** Per-row action buttons (right-aligned). */
  renderActions: (user: User) => ReactNode;
  /**
   * "table" (default) is a 4-column table best suited to full width.
   * "cards" stacks each user into a responsive block that fits its
   * container with no horizontal scroll — ideal for narrow columns.
   */
  variant?: "table" | "cards";
  /** When true, the list scrolls vertically within a capped height. */
  scrollable?: boolean;
}

export default function UsersSection({
  accent,
  icon: Icon,
  title,
  hint,
  count,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  users,
  loading,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyHint,
  renderActions,
  variant = "table",
  scrollable = false,
}: UsersSectionProps) {
  const { t } = useTranslation();
  const tone = ACCENT[accent];

  return (
    <Card className="ai-surface-strong overflow-hidden">
      <div className={`h-1 w-full bg-gradient-to-r ${tone.bar} to-transparent`} />
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${tone.icon}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <CardTitle className="text-xl">{title}</CardTitle>
              <Badge
                variant="secondary"
                className={`rounded-full border px-2.5 py-0.5 text-xs ${tone.badge}`}
              >
                {count}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 rounded-xl border-border/60 bg-background/70 pl-10 backdrop-blur-xl"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-20 rounded-xl animate-shimmer" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed py-14 text-center">
            <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tone.icon}`}>
              <EmptyIcon className="h-6 w-6" />
            </span>
            <p className="font-medium">{emptyTitle}</p>
            <p className="text-sm text-muted-foreground">{emptyHint}</p>
          </div>
        ) : variant === "cards" ? (
          <div
            className={`space-y-3 ${scrollable ? "max-h-[30rem] overflow-y-auto scrollbar-modern pr-1" : ""}`}
          >
            {users.map((user) => (
              <div
                key={user.id}
                className="rounded-xl border border-border/50 bg-card/40 p-4 transition-colors hover:bg-primary/[0.04]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <UserIdentity user={user} />
                  <div className="flex flex-wrap justify-end gap-2">{renderActions(user)}</div>
                </div>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <ContactFields user={user} />
                  <ProfileFields user={user} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/50 scrollbar-modern">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">{t("adminDashboard.th.user")}</th>
                  <th className="px-4 py-3 font-semibold">{t("adminDashboard.th.contact")}</th>
                  <th className="px-4 py-3 font-semibold">{t("adminDashboard.th.profile")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("adminDashboard.th.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border/50 align-top transition-colors odd:bg-muted/10 hover:bg-primary/[0.04]"
                  >
                    <td className="px-4 py-4">
                      <UserIdentity user={user} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2.5">
                        <ContactFields user={user} />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2.5">
                        <ProfileFields user={user} />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap justify-end gap-2">{renderActions(user)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
