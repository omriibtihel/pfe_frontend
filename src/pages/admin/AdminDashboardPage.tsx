import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck2,
  UserCog2,
  Users2,
  UserX2,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import AdminLayout from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import adminService, { AdminStats } from "@/services/adminService";
import { User } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: "easeOut" },
};

const STATUS_STYLE = {
  PENDING: { label: "En attente", color: "#f59e0b" },
  APPROVED: { label: "Approuves", color: "#22c55e" },
  REJECTED: { label: "Rejetes", color: "#ef4444" },
} as const;

const ROLE_STYLE = {
  DOCTOR: { label: "Medecins", color: "#0ea5e9" },
  ADMIN: { label: "Admins", color: "#fb923c" },
} as const;

function toPercent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function statusLabel(s?: string) {
  const v = (s || "").toUpperCase();
  if (v === "PENDING") return "En attente";
  if (v === "APPROVED") return "Approuve";
  if (v === "REJECTED") return "Rejete";
  return v || "-";
}

function roleLabel(r?: string) {
  const v = (r || "").toUpperCase();
  if (v === "ADMIN") return "Admin";
  if (v === "DOCTOR") return "Medecin";
  return v || "-";
}

function statusVariant(s?: string): "default" | "secondary" | "destructive" {
  const v = (s || "").toUpperCase();
  if (v === "PENDING") return "secondary";
  if (v === "REJECTED") return "destructive";
  return "default";
}

function initials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

type KpiCard = {
  id: string;
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  accentClass: string;
  iconClass: string;
};

export default function AdminDashboardPage() {
  const { toast } = useToast();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = async (showMainLoader = true) => {
    if (showMainLoader) setLoading(true);

    try {
      const [statsResponse, pendingResponse] = await Promise.all([
        adminService.getStats(),
        adminService.getPendingUsers(),
      ]);
      setStats(statsResponse);
      setPendingUsers(pendingResponse);
    } catch (error) {
      toast({
        title: "Erreur",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      if (showMainLoader) setLoading(false);
    }
  };

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const totalUsers = useMemo(() => {
    if (!stats) return 0;
    return stats.pending_users + stats.approved_users + stats.rejected_users;
  }, [stats]);

  const statusData = useMemo(() => {
    if (!stats) return [];
    return [
      {
        key: "PENDING",
        label: STATUS_STYLE.PENDING.label,
        value: stats.pending_users,
        color: STATUS_STYLE.PENDING.color,
      },
      {
        key: "APPROVED",
        label: STATUS_STYLE.APPROVED.label,
        value: stats.approved_users,
        color: STATUS_STYLE.APPROVED.color,
      },
      {
        key: "REJECTED",
        label: STATUS_STYLE.REJECTED.label,
        value: stats.rejected_users,
        color: STATUS_STYLE.REJECTED.color,
      },
    ];
  }, [stats]);

  const roleData = useMemo(() => {
    if (!stats) return [];
    return [
      {
        key: "DOCTOR",
        label: ROLE_STYLE.DOCTOR.label,
        value: stats.doctors,
        color: ROLE_STYLE.DOCTOR.color,
      },
      {
        key: "ADMIN",
        label: ROLE_STYLE.ADMIN.label,
        value: stats.admins,
        color: ROLE_STYLE.ADMIN.color,
      },
    ];
  }, [stats]);

  const roleTotal = useMemo(
    () => roleData.reduce((sum, item) => sum + item.value, 0),
    [roleData]
  );

  const approvalRate = useMemo(
    () => toPercent(stats?.approved_users ?? 0, totalUsers),
    [stats, totalUsers]
  );

  const pendingRate = useMemo(
    () => toPercent(stats?.pending_users ?? 0, totalUsers),
    [stats, totalUsers]
  );

  const rejectionRate = useMemo(
    () => toPercent(stats?.rejected_users ?? 0, totalUsers),
    [stats, totalUsers]
  );

  const statusBreakdown = useMemo(() => {
    return statusData.map((item) => ({
      ...item,
      percent: toPercent(item.value, totalUsers),
    }));
  }, [statusData, totalUsers]);

  const kpis = useMemo<KpiCard[]>(() => {
    return [
      {
        id: "total",
        label: "Total comptes",
        value: stats ? String(totalUsers) : "-",
        helper: "base utilisateurs",
        icon: Users2,
        accentClass:
          "from-sky-500/18 via-cyan-500/8 to-transparent border-sky-500/20",
        iconClass: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
      },
      {
        id: "pending",
        label: "En attente",
        value: stats ? String(stats.pending_users) : "-",
        helper: `${pendingRate}% du volume`,
        icon: Clock3,
        accentClass:
          "from-amber-500/18 via-amber-400/8 to-transparent border-amber-500/20",
        iconClass: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
      },
      {
        id: "approved",
        label: "Approuves",
        value: stats ? `${approvalRate}%` : "-",
        helper: `${stats?.approved_users ?? 0} comptes valides`,
        icon: UserCheck2,
        accentClass:
          "from-emerald-500/18 via-emerald-400/8 to-transparent border-emerald-500/20",
        iconClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
      },
      {
        id: "rejected",
        label: "Rejetes",
        value: stats ? `${rejectionRate}%` : "-",
        helper: `${stats?.rejected_users ?? 0} comptes refuses`,
        icon: UserX2,
        accentClass:
          "from-rose-500/18 via-rose-400/8 to-transparent border-rose-500/20",
        iconClass: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
      },
    ];
  }, [approvalRate, pendingRate, rejectionRate, stats, totalUsers]);

  const filteredPending = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pendingUsers;
    return pendingUsers.filter(
      (user) =>
        user.fullName?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
    );
  }, [pendingUsers, search]);

  const approve = async (user: User) => {
    setActionLoadingId(user.id);
    try {
      await adminService.approveUser(user.id);
      toast({
        title: "Succes",
        description: `Utilisateur approuve: ${user.fullName}`,
      });
      await load(false);
    } catch (error) {
      toast({
        title: "Erreur",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const openReject = (user: User) => {
    setRejectTarget(user);
    setRejectReason("");
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;

    setActionLoadingId(rejectTarget.id);
    try {
      await adminService.rejectUser(rejectTarget.id, rejectReason.trim() || undefined);
      toast({
        title: "Succes",
        description: `Utilisateur rejete: ${rejectTarget.fullName}`,
      });
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectReason("");
      await load(false);
    } catch (error) {
      toast({
        title: "Erreur",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <AdminLayout>
      <motion.div {...fade} className="relative space-y-6">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl">
          <div className="absolute -left-28 -top-24 h-64 w-64 rounded-full bg-sky-400/15 blur-3xl" />
          <div className="absolute -right-20 top-16 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <section className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/18 via-cyan-500/8 to-emerald-500/12 p-5 shadow-premium sm:p-6">
          <div className="pointer-events-none absolute -right-24 -top-20 h-52 w-52 rounded-full border border-white/25 bg-white/20 blur-2xl dark:bg-white/5" />
          <div className="pointer-events-none absolute -left-20 bottom-0 h-40 w-40 rounded-full bg-sky-600/20 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Badge className="rounded-full bg-foreground/10 px-3 py-1 text-xs text-foreground hover:bg-foreground/10">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Admin Control Center
              </Badge>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Dashboard admin
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-foreground/75 sm:text-base">
                  Vision temps reel des validations, du flux de moderation et de la
                  composition des comptes.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                className="border-foreground/20 bg-background/65 backdrop-blur-xl"
                onClick={refreshAll}
                disabled={refreshing || loading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Rafraichir les donnees
              </Button>
              <Badge
                variant="secondary"
                className="h-10 rounded-xl border border-foreground/15 bg-background/55 px-3 text-sm"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Queue: {stats?.pending_users ?? 0}
              </Badge>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi, index) => (
            <motion.div
              key={kpi.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * index, duration: 0.35 }}
            >
              <Card
                className={`group relative overflow-hidden border ${kpi.accentClass} bg-gradient-to-br shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-premium`}
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-foreground/5 blur-xl" />
                <CardContent className="relative p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {kpi.label}
                      </p>
                      <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                        {kpi.value}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{kpi.helper}</p>
                    </div>
                    <span
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${kpi.iconClass}`}
                    >
                      <kpi.icon className="h-5 w-5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <Card className="ai-surface-strong xl:col-span-3">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl">Etat des validations</CardTitle>
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                  {totalUsers} comptes
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Distribution des statuts sur l&apos;ensemble de la base.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 pt-2 lg:grid-cols-[2fr,1fr]">
              <div className="h-[300px]">
                {!stats || totalUsers === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                    Aucune donnee disponible
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={3}
                      >
                        {statusData.map((item) => (
                          <Cell key={item.key} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card) / 0.96)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="space-y-3">
                {statusBreakdown.map((item) => (
                  <div key={item.key} className="rounded-xl border bg-card/70 p-3 backdrop-blur-xl">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <span className="text-muted-foreground">{item.percent}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.percent}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{item.value} comptes</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="ai-surface xl:col-span-2">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl">Composition des roles</CardTitle>
                <UserCog2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Repartition des medecins et des administrateurs.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="h-[220px]">
                {!stats || roleTotal === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                    Aucune donnee disponible
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={roleData} barCategoryGap="35%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card) / 0.96)",
                        }}
                      />
                      <Bar dataKey="value" radius={[10, 10, 4, 4]}>
                        {roleData.map((item) => (
                          <Cell key={item.key} fill={item.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {roleData.map((item) => (
                  <div key={item.key} className="rounded-xl border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-2 text-2xl font-bold" style={{ color: item.color }}>
                      {item.value}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {toPercent(item.value, roleTotal)}% du total roles
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="ai-surface-strong overflow-hidden">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl">Utilisateurs en attente</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Validez ou rejetez rapidement les nouvelles inscriptions.
                </p>
              </div>

              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 rounded-xl border-border/60 bg-background/70 pl-10 backdrop-blur-xl"
                  placeholder="Rechercher (nom / email)..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="h-14 rounded-xl animate-shimmer" />
                ))}
              </div>
            ) : filteredPending.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed py-14 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <p className="font-medium">Aucun utilisateur en attente</p>
                <p className="text-sm text-muted-foreground">La file de moderation est vide.</p>
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-modern">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-3 pr-4 font-semibold">Utilisateur</th>
                      <th className="py-3 pr-4 font-semibold">Role</th>
                      <th className="py-3 pr-4 font-semibold">Statut</th>
                      <th className="py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPending.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-border/50 transition-colors hover:bg-muted/35"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-muted/70 font-semibold">
                              {initials(user.fullName)}
                            </span>
                            <div>
                              <p className="font-semibold">{user.fullName}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="secondary" className="rounded-full px-3">
                            {roleLabel(user.role)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={statusVariant(user.status)} className="rounded-full px-3">
                            {statusLabel(user.status)}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              className="rounded-lg"
                              onClick={() => approve(user)}
                              disabled={actionLoadingId === user.id}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Approuver
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              className="rounded-lg"
                              onClick={() => openReject(user)}
                              disabled={actionLoadingId === user.id}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Rejeter
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="glass-premium sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rejeter l&apos;utilisateur</DialogTitle>
            <DialogDescription>
              {rejectTarget ? (
                <>
                  Vous allez rejeter <strong>{rejectTarget.fullName}</strong>. Vous pouvez
                  preciser une raison (optionnel).
                </>
              ) : (
                "Vous pouvez preciser une raison (optionnel)."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="rejectReason">Raison</Label>
            <Textarea
              id="rejectReason"
              className="min-h-[120px] resize-none rounded-xl"
              placeholder="Ex: informations manquantes, email invalide, etc."
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={4}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => setRejectOpen(false)}
              disabled={actionLoadingId === rejectTarget?.id}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              className="rounded-lg"
              onClick={confirmReject}
              disabled={!rejectTarget || actionLoadingId === rejectTarget?.id}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
