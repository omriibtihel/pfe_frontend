import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, Mail, Loader2, ArrowRight, ArrowLeft, MailCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AuthLayout } from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import authService from "@/services/authService";

const formVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fieldVariants: any = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (error) {
      toast({
        title: t("auth.forgotPasswordPage.errorTitle"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
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

        {sent ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <MailCheck className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-semibold tracking-tight">
                {t("auth.forgotPasswordPage.sentTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("auth.forgotPasswordPage.sentDesc")}
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("auth.forgotPasswordPage.backToLogin")}
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="space-y-1.5">
              <h2 className="text-2xl font-semibold tracking-tight">
                {t("auth.forgotPasswordPage.title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("auth.forgotPasswordPage.subtitle")}
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
                <Label htmlFor="email">{t("auth.forgotPasswordPage.emailLabel")}</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    placeholder={t("auth.forgotPasswordPage.emailPlaceholder")}
                    required
                    autoComplete="email"
                  />
                </div>
              </motion.div>

              <motion.div variants={fieldVariants}>
                <Button type="submit" className="mt-2 w-full gap-2" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("auth.forgotPasswordPage.submitting")}
                    </>
                  ) : (
                    <>
                      {t("auth.forgotPasswordPage.submit")}
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
                {t("auth.forgotPasswordPage.backToLogin")}
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
