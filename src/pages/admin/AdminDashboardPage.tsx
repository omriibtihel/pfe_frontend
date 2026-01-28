// src/pages/admin/AdminDashboardPage.tsx
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import AdminLayout from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import adminService, { AdminStats } from "@/services/adminService";
import { User } from "@/types";
import { CheckCircle2, RefreshCw, Search, XCircle } from "lucide-react";

// shadcn dialog
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

// recharts (si tu l'as déjà / sinon: npm i recharts)
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

function statusLabel(s?: string) {
  const v = (s || "").toUpperCase();
  if (v === "PENDING") return "En attente";
  if (v === "APPROVED") return "Approuvé";
  if (v === "REJECTED") return "Rejeté";
  return v || "—";
}

function roleLabel(r?: string) {
  const v = (r || "").toUpperCase();
  if (v === "ADMIN") return "Admin";
  if (v === "DOCTOR") return "Médecin";
  return v || "—";
}

function statusVariant(s?: string): "default" | "secondary" | "destructive" {
  const v = (s || "").toUpperCase();
  if (v === "PENDING") return "secondary";
  if (v === "REJECTED") return "destructive";
  return "default";
}

export default function AdminDashboardPage() {
  const { toast } = useToast();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Dialog reject + reason
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = async (showMainLoader = true) => {
    if (showMainLoader) setLoading(true);
    try {
      const [s, p] = await Promise.all([
        adminService.getStats(),
        adminService.getPendingUsers(),
      ]);
      setStats(s);
      setPendingUsers(p);
    } catch (e) {
      toast({
        title: "Erreur",
        description: (e as Error).message,
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

  const pieData = useMemo(() => {
    const by = stats?.by_status ?? {};
    return Object.entries(by).map(([status, value]) => ({ status, value }));
  }, [stats]);

  const barData = useMemo(() => {
    const by = stats?.by_status ?? {};
    const order = ["PENDING", "APPROVED", "REJECTED"];
    return order.filter((k) => k in by).map((k) => ({ status: k, value: by[k] }));
  }, [stats]);

  const filteredPending = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pendingUsers;
    return pendingUsers.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [pendingUsers, search]);

  const approve = async (u: User) => {
    setActionLoadingId(u.id);
    try {
      await adminService.approveUser(u.id);
      toast({
        title: "Succès",
        description: `Utilisateur approuvé: ${u.fullName}`,
      });

      // refresh stats + liste après action
      await load(false);
    } catch (e) {
      toast({
        title: "Erreur",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const openReject = (u: User) => {
    setRejectTarget(u);
    setRejectReason("");
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;

    setActionLoadingId(rejectTarget.id);
    try {
      await adminService.rejectUser(rejectTarget.id, rejectReason.trim() || undefined);
      toast({
        title: "Succès",
        description: `Utilisateur rejeté: ${rejectTarget.fullName}`,
      });

      setRejectOpen(false);
      setRejectTarget(null);
      setRejectReason("");

      // refresh stats + liste après action
      await load(false);
    } catch (e) {
      toast({
        title: "Erreur",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <AdminLayout>
      <motion.div {...fade} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Admin</h1>
            <p className="text-muted-foreground mt-1">
              Statistiques globales et gestion des inscriptions en attente
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={refreshAll} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Rafraîchir
            </Button>
          </div>
        </div>

        {/* Stats + Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Résumé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total utilisateurs</span>
                <span className="font-semibold">{stats?.total_users ?? "—"}</span>
              </div>

              <div className="space-y-2">
                {["PENDING", "APPROVED", "REJECTED"].map((k) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{k}</span>
                    <span className="font-medium">{stats?.by_status?.[k] ?? 0}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-xs text-muted-foreground">
                Les comptes sont créés en <strong>PENDING</strong> puis validés par l’admin.
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Répartition (Pie)</CardTitle>
            </CardHeader>
            <CardContent className="h-[260px]">
              {pieData.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="status" outerRadius={90} />
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Comptes par statut (Bar)</CardTitle>
            </CardHeader>
            <CardContent className="h-[260px]">
              {barData.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending users table */}
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <CardTitle>Utilisateurs en attente</CardTitle>

              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Rechercher (nom / email)…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Chargement…</div>
            ) : filteredPending.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Aucun utilisateur en attente 🎉
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-3 pr-4">Nom</th>
                      <th className="py-3 pr-4">Email</th>
                      <th className="py-3 pr-4">Rôle</th>
                      <th className="py-3 pr-4">Statut</th>
                      <th className="py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPending.map((u) => (
                      <tr key={u.id} className="border-b last:border-b-0">
                        <td className="py-3 pr-4 font-medium">{u.fullName}</td>
                        <td className="py-3 pr-4">{u.email}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="secondary">{roleLabel(u.role)}</Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={statusVariant(u.status)}>
                            {statusLabel(u.status)}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => approve(u)}
                              disabled={actionLoadingId === u.id}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approuver
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openReject(u)}
                              disabled={actionLoadingId === u.id}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
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

      {/* Reject Dialog (shadcn) */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rejeter l’utilisateur</DialogTitle>
            <DialogDescription>
              {rejectTarget ? (
                <>
                  Vous êtes sur le point de rejeter{" "}
                  <strong>{rejectTarget.fullName}</strong>. Vous pouvez préciser
                  une raison (optionnel).
                </>
              ) : (
                "Vous pouvez préciser une raison (optionnel)."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="rejectReason">Raison</Label>
            <Textarea
              id="rejectReason"
              placeholder="Ex: informations manquantes, email invalide, etc."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={actionLoadingId === rejectTarget?.id}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectTarget || actionLoadingId === rejectTarget?.id}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
