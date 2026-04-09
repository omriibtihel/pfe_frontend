import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Mail,
  Lock,
  User,
  Phone,
  Calendar,
  MapPin,
  Upload,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { SignupData } from "@/types";

const formVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const fieldVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
};

const iconSpring = { type: "spring", stiffness: 380, damping: 22 } as const;

export function SignupPage() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    dateOfBirth: "",
    phone: "",
    address: "",
  });

  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { signup } = useAuth();
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;

  const iconAnimate = (field: string) =>
    animate
      ? { y: "-50%", scale: focusedField === field ? 1.2 : 1 }
      : { y: "-50%", scale: 1 };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const navigate = useNavigate();
  const { toast } = useToast();

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const signupPayload: SignupData = {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        specialty: "",
        qualification: "",
        experience: 0,
        phone: formData.phone,
        address: formData.address,
        hospital: "",
        dateOfBirth: formData.dateOfBirth,
        profilePhoto: profilePhoto ?? undefined,
      };

      const result = await signup(signupPayload);

      toast({ title: t("auth.signup.successTitle"), description: result.message });
      navigate("/login");
    } catch (error) {
      toast({
        title: t("auth.signup.errorTitle"),
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6 sm:space-y-7">
        {/* Mobile logo */}
        <div className="flex items-center justify-center gap-2.5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Activity className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold">MedicalVision</span>
        </div>

        {/* Header */}
        <div className="space-y-1.5">
          <h2 className="text-2xl font-semibold tracking-tight">{t("auth.signup.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("auth.signup.subtitle")}</p>
        </div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-4 sm:space-y-5"
          initial={animate ? "hidden" : false}
          animate="visible"
          variants={formVariants}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <motion.div variants={fieldVariants} className="space-y-1.5">
              <Label htmlFor="fullName">{t("auth.signup.fullNameLabel")}</Label>
              <div className="relative">
                <motion.span
                  className="pointer-events-none absolute left-3 top-1/2 flex"
                  animate={iconAnimate("fullName")}
                  transition={iconSpring}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                </motion.span>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  onFocus={() => setFocusedField("fullName")}
                  onBlur={() => setFocusedField(null)}
                  className="pl-9"
                  placeholder={t("auth.signup.fullNamePlaceholder")}
                  required
                />
              </div>
            </motion.div>

            <motion.div variants={fieldVariants} className="space-y-1.5">
              <Label htmlFor="email">{t("auth.signup.emailLabel")}</Label>
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
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  className="pl-9"
                  placeholder={t("auth.signup.emailPlaceholder")}
                  required
                />
              </div>
            </motion.div>

            <motion.div variants={fieldVariants} className="space-y-1.5">
              <Label htmlFor="password">{t("auth.signup.passwordLabel")}</Label>
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
                  value={formData.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  className="pl-9"
                  placeholder="••••••••"
                  required
                />
              </div>
            </motion.div>

            <motion.div variants={fieldVariants} className="space-y-1.5">
              <Label htmlFor="dateOfBirth">{t("auth.signup.dobLabel")}</Label>
              <div className="relative">
                <motion.span
                  className="pointer-events-none absolute left-3 top-1/2 flex"
                  animate={iconAnimate("dateOfBirth")}
                  transition={iconSpring}
                >
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </motion.span>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => updateField("dateOfBirth", e.target.value)}
                  onFocus={() => setFocusedField("dateOfBirth")}
                  onBlur={() => setFocusedField(null)}
                  className="pl-9"
                />
              </div>
            </motion.div>

            <motion.div variants={fieldVariants} className="space-y-1.5">
              <Label htmlFor="phone">{t("auth.signup.phoneLabel")}</Label>
              <div className="relative">
                <motion.span
                  className="pointer-events-none absolute left-3 top-1/2 flex"
                  animate={iconAnimate("phone")}
                  transition={iconSpring}
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </motion.span>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  onFocus={() => setFocusedField("phone")}
                  onBlur={() => setFocusedField(null)}
                  className="pl-9"
                  placeholder={t("auth.signup.phonePlaceholder")}
                />
              </div>
            </motion.div>

            <motion.div variants={fieldVariants} className="space-y-1.5">
              <Label htmlFor="address">{t("auth.signup.establishmentLabel")}</Label>
              <div className="relative">
                <motion.span
                  className="pointer-events-none absolute left-3 top-1/2 flex"
                  animate={iconAnimate("address")}
                  transition={iconSpring}
                >
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </motion.span>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  onFocus={() => setFocusedField("address")}
                  onBlur={() => setFocusedField(null)}
                  className="pl-9"
                  placeholder={t("auth.signup.establishmentPlaceholder")}
                />
              </div>
            </motion.div>
          </div>

          {/* Photo upload */}
          <motion.div variants={fieldVariants} className="space-y-1.5">
            <Label>
              {t("auth.signup.photoLabel")}{" "}
              <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-20 w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
            >
              {photoPreview ? (
                <>
                  <img
                    src={photoPreview}
                    alt="Aperçu"
                    className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/20"
                  />
                  <span className="max-w-[180px] truncate text-xs">{profilePhoto?.name}</span>
                </>
              ) : (
                <>
                  <motion.span
                    whileHover={animate ? { scale: 1.2, rotate: -8 } : undefined}
                    transition={iconSpring}
                    className="flex"
                  >
                    <Upload className="h-4 w-4" />
                  </motion.span>
                  {t("auth.signup.photoButton")}
                </>
              )}
            </button>
          </motion.div>

          <motion.div variants={fieldVariants}>
            <Button type="submit" className="w-full gap-2" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("auth.signup.submitting")}
                </>
              ) : (
                <>
                  {t("auth.signup.submit")}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </motion.div>
        </motion.form>

        <p className="text-center text-sm text-muted-foreground">
          {t("auth.signup.hasAccount")}{" "}
          <Link
            to="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("auth.signup.loginLink")}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default SignupPage;
