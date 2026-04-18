import { useRef, useState } from 'react';
import {
  User, Mail, Phone, Building2, Stethoscope, MapPin,
  Calendar, Edit2, Save, X, Loader2, Camera, ShieldCheck,
  Activity, LogOut, ChevronRight,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import authService from '@/services/authService';
import { useToast } from '@/hooks/use-toast';

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = 'contact' | 'pro';

/* ─── tiny field component ─── */
function ProfileField({
  icon: Icon,
  label,
  value,
  fieldKey,
  type = 'text',
  isEditing,
  onChange,
}: {
  icon: typeof User;
  label: string;
  value: string;
  fieldKey: string;
  type?: string;
  isEditing: boolean;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <div className="group relative flex items-start gap-3 p-3.5 rounded-2xl border border-transparent hover:border-border/40 hover:bg-muted/20 transition-all duration-200">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-primary/15 transition-colors">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <AnimatePresence mode="wait" initial={false}>
          {isEditing ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
            >
              <Input
                type={type}
                value={value}
                onChange={(e) => onChange(fieldKey, e.target.value)}
                className="h-8 text-sm bg-muted/30 border-border/40 focus:border-primary/60 rounded-lg"
              />
            </motion.div>
          ) : (
            <motion.p
              key="text"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="text-sm font-medium truncate"
            >
              {value || <span className="text-muted-foreground/60 italic font-normal">Non renseigné</span>}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── main component ─── */
export function UserProfileDialog({ open, onOpenChange }: UserProfileDialogProps) {
  const { user, updateUser, logout } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('contact');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [edited, setEdited] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    address: user?.address || '',
    specialty: user?.specialty || '',
    hospital: user?.hospital || '',
    dateOfBirth: user?.dateOfBirth || '',
  });

  const fieldChange = (k: string, v: string) => setEdited(prev => ({ ...prev, [k]: v }));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await authService.updateProfile({
        fullName: edited.fullName,
        phone: edited.phone,
        address: edited.address,
        specialty: edited.specialty,
        hospital: edited.hospital,
        dateOfBirth: edited.dateOfBirth,
        profilePhoto: photoFile ?? undefined,
      });
      updateUser(updated);
      setPhotoFile(null);
      setPhotoPreview(null);
      setIsEditing(false);
      toast({ title: 'Profil mis à jour', description: 'Vos informations ont été sauvegardées.' });
    } catch (err) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEdited({
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      address: user?.address || '',
      specialty: user?.specialty || '',
      hospital: user?.hospital || '',
      dateOfBirth: user?.dateOfBirth || '',
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setIsEditing(false);
  };

  const avatarSrc = photoPreview
    ?? (user?.profilePhoto ? `http://127.0.0.1:8000${user.profilePhoto}` : null);

  const initials = (user?.fullName || 'U')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isAdmin = user?.role === 'admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-md w-full border-0 shadow-2xl bg-transparent">
        <div className="relative flex flex-col rounded-2xl overflow-hidden glass-premium border border-border/40">

          {/* ── Close button ── */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 z-20 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          {/* ── Header banner ── */}
          <div className="relative h-28 overflow-hidden flex-shrink-0">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent opacity-90" />
            {/* Mesh pattern */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px),
                  radial-gradient(circle at 80% 20%, white 1px, transparent 1px),
                  radial-gradient(circle at 60% 80%, white 1px, transparent 1px)`,
                backgroundSize: '30px 30px',
              }}
            />
            {/* Orbs */}
            <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-white/10 blur-xl" />
            <div className="absolute -bottom-4 right-8 w-20 h-20 rounded-full bg-white/10 blur-xl" />

            {/* Role chip top-left */}
            <div className="absolute top-4 left-4">
              <div className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide",
                isAdmin
                  ? "bg-white/20 text-white"
                  : "bg-white/15 text-white"
              )}>
                {isAdmin
                  ? <><ShieldCheck className="w-3 h-3" />Admin</>
                  : <><Stethoscope className="w-3 h-3" />Médecin</>
                }
              </div>
            </div>

            {/* Active dot top right */}
            <div className="absolute top-4 right-10 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/50 animate-pulse" />
              <span className="text-[11px] text-white/80 font-medium">Actif</span>
            </div>
          </div>

          {/* ── Avatar (overlapping header) ── */}
          <div className="relative flex flex-col items-center -mt-12 px-6 pb-2 z-10">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />

            {/* Avatar ring */}
            <div
              className={cn(
                "relative rounded-2xl p-0.5 bg-gradient-to-br from-primary via-secondary to-accent shadow-xl",
                isEditing && "cursor-pointer"
              )}
              onClick={() => isEditing && fileInputRef.current?.click()}
            >
              <div className="relative w-20 h-20 rounded-[calc(1rem-2px)] overflow-hidden bg-background">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={user?.fullName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">{initials}</span>
                  </div>
                )}

                {/* Edit overlay */}
                <AnimatePresence>
                  {isEditing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1"
                    >
                      <Camera className="w-5 h-5 text-white" />
                      <span className="text-[9px] text-white font-semibold">Changer</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Stethoscope badge */}
              <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center shadow-lg">
                <Activity className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            {/* Name + email */}
            <div className="mt-3 text-center">
              <AnimatePresence mode="wait" initial={false}>
                {isEditing ? (
                  <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Input
                      value={edited.fullName}
                      onChange={(e) => fieldChange('fullName', e.target.value)}
                      className="text-center font-bold text-base h-9 w-48"
                      placeholder="Nom complet"
                    />
                  </motion.div>
                ) : (
                  <motion.h3 key="name" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-base font-bold"
                  >
                    {user?.fullName || '—'}
                  </motion.h3>
                )}
              </AnimatePresence>
              <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="px-5 mt-1 flex gap-1 border-b border-border/30">
            {([['contact', 'Contact'], ['pro', 'Professionnel']] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
                {activeTab === t && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-primary to-secondary"
                  />
                )}
              </button>
            ))}
          </div>

          {/* ── Fields ── */}
          <div className="px-4 py-3 min-h-[200px]">
            <AnimatePresence mode="wait" initial={false}>
              {activeTab === 'contact' ? (
                <motion.div
                  key="contact"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-1"
                >
                  {/* Email (non-editable) */}
                  <div className="flex items-start gap-3 p-3.5 rounded-2xl">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Email</p>
                      <p className="text-sm font-medium truncate">{user?.email}</p>
                    </div>
                  </div>

                  <ProfileField icon={Phone}    label="Téléphone"          fieldKey="phone"        value={edited.phone}       isEditing={isEditing} onChange={fieldChange} />
                  <ProfileField icon={MapPin}   label="Adresse"            fieldKey="address"      value={edited.address}     isEditing={isEditing} onChange={fieldChange} />
                  <ProfileField icon={Calendar} label="Date de naissance"  fieldKey="dateOfBirth"  value={edited.dateOfBirth} isEditing={isEditing} onChange={fieldChange} type="date" />
                </motion.div>
              ) : (
                <motion.div
                  key="pro"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-1"
                >
                  <ProfileField icon={Stethoscope} label="Spécialité"          fieldKey="specialty" value={edited.specialty} isEditing={isEditing} onChange={fieldChange} />
                  <ProfileField icon={Building2}   label="Établissement"       fieldKey="hospital"  value={edited.hospital}  isEditing={isEditing} onChange={fieldChange} />

                  {/* Static info chip */}
                  {!isEditing && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 p-3.5 rounded-2xl bg-primary/5 border border-primary/15 flex items-center gap-3"
                    >
                      <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-primary">Compte vérifié</p>
                        <p className="text-[11px] text-muted-foreground">Données protégées · RGPD conforme</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Footer actions ── */}
          <div className="px-5 pb-5 pt-2 flex items-center gap-2 border-t border-border/30 mt-1">
            <AnimatePresence mode="wait">
              {isEditing ? (
                <motion.div
                  key="editing-actions"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex gap-2 w-full"
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancel}
                    className="flex-1 rounded-xl"
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 rounded-xl bg-gradient-to-r from-primary to-secondary text-white shadow-glow-sm hover:opacity-90 transition-opacity"
                  >
                    {isSaving
                      ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      : <Save className="h-4 w-4 mr-1.5" />
                    }
                    Sauvegarder
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="view-actions"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex gap-2 w-full"
                >
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="flex-1 rounded-xl border-border/50 hover:border-primary/40"
                  >
                    <Edit2 className="h-4 w-4 mr-1.5" />
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { logout?.(); onOpenChange(false); }}
                    className="rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UserProfileDialog;
