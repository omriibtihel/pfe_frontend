import { useRef, useState } from 'react';
import { User, Mail, Phone, Building2, Stethoscope, MapPin, Calendar, Edit2, Save, X, Loader2, Camera } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import authService from '@/services/authService';
import { useToast } from '@/hooks/use-toast';

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({ open, onOpenChange }: UserProfileDialogProps) {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const Field = ({ icon: Icon, label, fieldKey }: {
    icon: typeof User;
    label: string;
    fieldKey: keyof typeof edited;
  }) => (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        {isEditing ? (
          <Input
            type={fieldKey === 'dateOfBirth' ? 'date' : 'text'}
            value={edited[fieldKey]}
            onChange={(e) => setEdited({ ...edited, [fieldKey]: e.target.value })}
            className="mt-1 h-8 text-sm"
          />
        ) : (
          <p className="font-semibold text-sm truncate">{edited[fieldKey] || <span className="text-muted-foreground italic">Non renseigné</span>}</p>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto glass-premium border-border/50">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">Profil Médecin</DialogTitle>
            <div className="flex items-center gap-2">
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div
                    key="editing"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex gap-2"
                  >
                    <Button size="sm" variant="ghost" onClick={handleCancel} className="rounded-lg">
                      <X className="h-4 w-4 mr-1" />
                      Annuler
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving} className="rounded-lg bg-primary text-primary-foreground">
                      {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                      Sauvegarder
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="view"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="rounded-lg">
                      <Edit2 className="h-4 w-4 mr-1" />
                      Modifier
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </DialogHeader>

        {/* Profile Header */}
        <div className="flex flex-col items-center py-6">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          <div className="relative">
            <div
              className={cn("w-24 h-24 rounded-2xl shadow-xl shadow-primary/25 overflow-hidden", isEditing && "cursor-pointer")}
              onClick={() => isEditing && fileInputRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
              ) : user?.profilePhoto ? (
                <img src={`http://127.0.0.1:8000${user.profilePhoto}`} alt={user.fullName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center">
                  <User className="h-12 w-12 text-white" />
                </div>
              )}
              {isEditing && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-green-500 border-4 border-background flex items-center justify-center">
              <Stethoscope className="h-4 w-4 text-white" />
            </div>
          </div>

          <div className="mt-4 text-center">
            {isEditing ? (
              <Input
                value={edited.fullName}
                onChange={(e) => setEdited({ ...edited, fullName: e.target.value })}
                className="text-center text-xl font-bold h-10"
              />
            ) : (
              <h3 className="text-xl font-bold">{user?.fullName}</h3>
            )}
            <p className="text-muted-foreground mt-1">{user?.email}</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold",
                user?.role === 'admin' 
                  ? "bg-accent/20 text-accent" 
                  : "bg-primary/20 text-primary"
              )}>
                {user?.role === 'admin' ? 'Administrateur' : 'Médecin'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-600 dark:text-green-400">
                Actif
              </span>
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Contact Information */}
        <div className="space-y-4 py-4">
          <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">
            Informations de contact
          </h4>
          <div className="grid gap-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">Email</p>
                <p className="font-semibold text-sm truncate">{user?.email}</p>
              </div>
            </div>
            <Field icon={Phone} label="Téléphone" fieldKey="phone" />
            <Field icon={MapPin} label="Adresse" fieldKey="address" />
            <Field icon={Calendar} label="Date de naissance" fieldKey="dateOfBirth" />
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Professional Information */}
        <div className="space-y-4 py-4">
          <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">
            Informations professionnelles
          </h4>
          <div className="grid gap-3">
            <Field icon={Stethoscope} label="Spécialité" fieldKey="specialty" />
            <Field icon={Building2} label="Établissement / Hôpital" fieldKey="hospital" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UserProfileDialog;
