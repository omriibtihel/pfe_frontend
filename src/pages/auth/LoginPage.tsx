import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const formVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

// Cast to silence framer-motion's strict Easing type — runtime accepts the cubic-bezier array.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fieldVariants: any = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

const iconSpring = { type: "spring", stiffness: 380, damping: 22 } as const;

export function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;

  const iconAnimate = (field: string) =>
    animate
      ? { y: "-50%", scale: focusedField === field ? 1.2 : 1 }
      : { y: "-50%", scale: 1 };

  const extractErrorMessage = (error: unknown) => {
    const err = error as {
      message?: string;
      response?: { data?: { detail?: unknown } };
    };
    const detail = err.response?.data?.detail;

    if (!detail) return err.message || t("auth.login.defaultError");
    if (typeof detail === "string") return detail;

    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) return String((item as { msg?: unknown }).msg ?? "");
          return JSON.stringify(item);
        })
        .filter(Boolean)
        .join(", ");
    }

    return JSON.stringify(detail);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const user = await login({ email, password });

      toast({
        title: t("auth.login.successTitle"),
        description: t("auth.login.successDesc"),
      });

      if (user.role === "admin") navigate("/admin");
      else navigate("/dashboard");
    } catch (error) {
      toast({
        title: t("auth.login.errorTitle"),
        description: extractErrorMessage(error),
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
          <span className="text-lg font-bold">MedicalVision</span>
        </div>

        {/* Header */}
        <div className="space-y-1.5">
          <h2 className="text-2xl font-semibold tracking-tight">{t("auth.login.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("auth.login.subtitle")}</p>
        </div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-4"
          initial={animate ? "hidden" : false}
          animate="visible"
          variants={formVariants}
        >
          <motion.div variants={fieldVariants} className="space-y-1.5">
            <Label htmlFor="email">{t("auth.login.emailLabel")}</Label>
            <div className="relative">
              <motion.span
                className="pointer-events-none absolute left-3 top-1/2 flex"
                animate={iconAnimate("email")}
                transition={iconSpring}
              >
                <Mail className="h-4 w-4 text-muted-foreground" />
              </motion.span>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                className="pl-9"
                placeholder={t("auth.login.emailPlaceholder")}
                required
                autoComplete="email"
              />
            </div>
          </motion.div>

          <motion.div variants={fieldVariants} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("auth.login.passwordLabel")}</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("auth.login.forgotPassword")}
              </button>
            </div>
            <div className="relative">
              <motion.span
                className="pointer-events-none absolute left-3 top-1/2 flex"
                animate={iconAnimate("password")}
                transition={iconSpring}
              >
                <Lock className="h-4 w-4 text-muted-foreground" />
              </motion.span>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                className="pl-9"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          </motion.div>

          <motion.div variants={fieldVariants}>
            <Button type="submit" className="mt-2 w-full gap-2" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("auth.login.submitting")}
                </>
              ) : (
                <>
                  {t("auth.login.submit")}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </motion.div>
        </motion.form>

        <p className="text-center text-sm text-muted-foreground">
          {t("auth.login.noAccount")}{" "}
          <Link
            to="/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("auth.login.signupLink")}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default LoginPage;
