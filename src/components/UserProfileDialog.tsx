import { useState } from 'react';
import { User, Mail, Phone, Building2, Stethoscope, MapPin, Calendar, GraduationCap, Award, Edit2, Save, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DoctorProfile {
  specialty: string;
  hospital: string;
  phone: string;
  address: string;
  registrationNumber: string;
  yearsOfExperience: number;
  education: string;
  certifications: string[];
}

export function UserProfileDialog({ open, onOpenChange }: UserProfileDialogProps) {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  
  // Mock doctor profile data - in real app, this would come from API
  const [profile, setProfile] = useState<DoctorProfile>({
    specialty: 'Cardiologie',
    hospital: 'CHU de Lyon',
    phone: '+33 6 12 34 56 78',
    address: 'Lyon, France',
    registrationNumber: 'RPPS-12345678901',
    yearsOfExperience: 12,
    education: 'Université Paris Descartes - Médecine',
    certifications: ['Cardiologie interventionnelle', 'Échocardiographie', 'Rythmologie']
  });

  const [editedProfile, setEditedProfile] = useState(profile);
  const [editedName, setEditedName] = useState(user?.fullName || '');

  const handleSave = () => {
    setProfile(editedProfile);
    if (editedName !== user?.fullName) {
      updateUser({ fullName: editedName });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setEditedName(user?.fullName || '');
    setIsEditing(false);
  };

  const InfoItem = ({ icon: Icon, label, value, editKey, type = 'text' }: { 
    icon: typeof User; 
    label: string; 
    value: string | number; 
    editKey?: keyof DoctorProfile;
    type?: string;
  }) => (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        {isEditing && editKey ? (
          <Input
            type={type}
            value={editedProfile[editKey] as string | number}
            onChange={(e) => setEditedProfile({ 
              ...editedProfile, 
              [editKey]: type === 'number' ? parseInt(e.target.value) || 0 : e.target.value 
            })}
            className="mt-1 h-8 text-sm"
          />
        ) : (
          <p className="font-semibold text-sm truncate">{value}</p>
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
                    <Button size="sm" onClick={handleSave} className="rounded-lg bg-primary text-primary-foreground">
                      <Save className="h-4 w-4 mr-1" />
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
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center shadow-xl shadow-primary/25">
              <User className="h-12 w-12 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-green-500 border-4 border-background flex items-center justify-center">
              <Stethoscope className="h-4 w-4 text-white" />
            </div>
          </div>
          
          <div className="mt-4 text-center">
            {isEditing ? (
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
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
            <InfoItem icon={Mail} label="Email" value={user?.email || ''} />
            <InfoItem icon={Phone} label="Téléphone" value={profile.phone} editKey="phone" />
            <InfoItem icon={MapPin} label="Localisation" value={profile.address} editKey="address" />
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Professional Information */}
        <div className="space-y-4 py-4">
          <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">
            Informations professionnelles
          </h4>
          <div className="grid gap-3">
            <InfoItem icon={Stethoscope} label="Spécialité" value={profile.specialty} editKey="specialty" />
            <InfoItem icon={Building2} label="Établissement" value={profile.hospital} editKey="hospital" />
            <InfoItem icon={Award} label="N° RPPS" value={profile.registrationNumber} editKey="registrationNumber" />
            <InfoItem icon={Calendar} label="Années d'expérience" value={`${profile.yearsOfExperience} ans`} editKey="yearsOfExperience" type="number" />
            <InfoItem icon={GraduationCap} label="Formation" value={profile.education} editKey="education" />
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Certifications */}
        <div className="space-y-4 py-4">
          <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">
            Certifications
          </h4>
          <div className="flex flex-wrap gap-2">
            {profile.certifications.map((cert, index) => (
              <span 
                key={index}
                className="px-3 py-1.5 rounded-lg bg-secondary/20 text-secondary text-sm font-medium border border-secondary/30"
              >
                {cert}
              </span>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UserProfileDialog;
