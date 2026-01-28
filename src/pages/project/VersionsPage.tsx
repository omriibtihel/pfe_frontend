import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitBranch, Search, Eye, Trash2, Target, Calendar, FileText, Info } from 'lucide-react';
import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmModal } from '@/components/ui/modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { dataService } from '@/services/dataService';
import { DataVersion } from '@/types';
import { staggerContainer, staggerItem } from '@/components/ui/page-transition';

export function VersionsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [versions, setVersions] = useState<DataVersion[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [deleteVersion, setDeleteVersion] = useState<DataVersion | null>(null);

  useEffect(() => {
    const loadVersions = async () => {
      const data = await dataService.getVersions(id!);
      setVersions(data);
    };
    loadVersions();
  }, [id]);

  const handleDelete = async () => {
    if (!deleteVersion) return;
    await dataService.deleteVersion(deleteVersion.id);
    setVersions(versions.filter(v => v.id !== deleteVersion.id));
    toast({ title: 'Version supprimée' });
    setDeleteVersion(null);
  };

  const filteredVersions = versions.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <motion.div 
        className="space-y-6"
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        <motion.div variants={staggerItem} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Historique des versions</h1>
            <p className="text-muted-foreground mt-1">Gérez les différentes versions de vos données</p>
          </div>
          <Badge variant="secondary" className="self-start md:self-auto">
            <GitBranch className="h-3 w-3 mr-1" />
            {versions.length} versions disponibles
          </Badge>
        </motion.div>

        {/* Filters */}
        <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une version..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les fichiers</SelectItem>
              <SelectItem value="predictable">Prêts à prédire</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Info Banner */}
        <motion.div variants={staggerItem}>
          <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
            <CardContent className="flex items-start gap-3 py-4">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Traçabilité complète</p>
                <p className="text-sm text-muted-foreground">
                  Chaque version conserve l'historique des opérations appliquées pour une reproductibilité totale.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Versions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVersions.map((version, index) => (
            <motion.div
              key={version.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, type: 'spring', stiffness: 260, damping: 20 }}
            >
              <Card className="card-hover h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      {version.name}
                    </CardTitle>
                    {version.canPredict && (
                      <Badge className="bg-success text-success-foreground">Prêt</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(version.createdAt).toLocaleDateString('fr-FR')}
                  </div>

                  {version.operations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Opérations:</p>
                      <div className="flex flex-wrap gap-1">
                        {version.operations.slice(0, 3).map((op, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{op}</Badge>
                        ))}
                        {version.operations.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{version.operations.length - 3}</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Eye className="h-4 w-4 mr-1" />
                      Voir
                    </Button>
                    {version.canPredict && (
                      <Button size="sm" className="flex-1 bg-gradient-to-r from-primary to-secondary" onClick={() => navigate(`/projects/${id}/predict`)}>
                        <Target className="h-4 w-4 mr-1" />
                        Prédire
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setDeleteVersion(version)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <ConfirmModal
        isOpen={!!deleteVersion}
        onClose={() => setDeleteVersion(null)}
        onConfirm={handleDelete}
        title="Supprimer la version"
        description={`Êtes-vous sûr de vouloir supprimer "${deleteVersion?.name}" ?`}
        variant="destructive"
        confirmText="Supprimer"
      />
    </AppLayout>
  );
}

export default VersionsPage;
