import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, Lock, Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AuthLayout } from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import authService from "@/services/authService";

const MIN_PASSWORD_LENGTH = 6;

const formVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fieldVariants: any = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;

  const fail = (message: string) =>
    toast({ title: t("auth.resetPasswordPage.errorTitle"), description: message, variant: "destructive" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) return fail(t("auth.resetPasswordPage.missingToken"));
    if (password.length < MIN_PASSWORD_LENGTH) return fail(t("auth.resetPasswordPage.tooShort"));
    if (password !== confirm) return fail(t("auth.resetPasswordPage.mismatch"));

    setIsLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
      toast({
        title: t("auth.resetPasswordPage.successTitle"),
        description: t("auth.resetPasswordPage.successDesc"),
      });
      setTimeout(() => navigate("/login"), 1800);
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6 sm:space-y-8">
        {/* Mobile logo */}
        <div className="flex items-center justify-center gap-2.5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Activity className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold">MedIQ</span>
        </div>

        {done ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-semibold tracking-tight">
                {t("auth.resetPasswordPage.successTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("auth.resetPasswordPage.successDesc")}
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("auth.resetPasswordPage.backToLogin")}
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="space-y-1.5">
              <h2 className="text-2xl font-semibold tracking-tight">
                {t("auth.resetPasswordPage.title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("auth.resetPasswordPage.subtitle")}
              </p>
            </div>

            <motion.form
              onSubmit={handleSubmit}
              className="space-y-4"
              initial={animate ? "hidden" : false}
              animate="visible"
              variants={formVariants}
            >
              <motion.div variants={fieldVariants} className="space-y-1.5">
                <Label htmlFor="password">{t("auth.resetPasswordPage.passwordLabel")}</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                  />
                </div>
              </motion.div>

              <motion.div variants={fieldVariants} className="space-y-1.5">
                <Label htmlFor="confirm">{t("auth.resetPasswordPage.confirmLabel")}</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-9"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                  />
                </div>
              </motion.div>

              <motion.div variants={fieldVariants}>
                <Button type="submit" className="mt-2 w-full gap-2" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("auth.resetPasswordPage.submitting")}
                    </>
                  ) : (
                    <>
                      {t("auth.resetPasswordPage.submit")}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </motion.div>
            </motion.form>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("auth.resetPasswordPage.backToLogin")}
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
