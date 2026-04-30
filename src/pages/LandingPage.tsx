import { Link } from 'react-router-dom';
import { motion, useMotionValue, useTransform, useSpring, useInView, animate } from 'framer-motion';
import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Brain,
  BarChart3,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
  Star,
  Sparkles,
  Database,
  TrendingUp,
  Upload,
  Cpu,
  FlaskConical,
  ChevronRight,
  Play,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ─────────────────────────────── helpers ─────────────────────────────── */

function useCountUp(target: number, duration = 2) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, target, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setCount(Math.round(v)),
    });
    return controls.stop;
  }, [inView, target, duration]);

  return { count, ref };
}

/* ── 3-D tilt card ── */
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 300, damping: 30 });

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current!.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }, [x, y]);

  const onMouseLeave = useCallback(() => { x.set(0); y.set(0); }, [x, y]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 800 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────── data ─────────────────────────────── */

const features = [
  { icon: Brain,     title: "IA Avancée",              description: "Algorithmes de machine learning de pointe — Random Forest, XGBoost, réseaux de neurones — pour des prédictions précises.", color: "from-blue-500 to-cyan-400"    },
  { icon: Database,  title: "Gestion des Données",      description: "Importez CSV/Excel, nettoyez automatiquement, détectez les anomalies et transformez vos données médicales.",             color: "from-cyan-500 to-teal-400"    },
  { icon: BarChart3, title: "Visualisation Avancée",    description: "Graphiques interactifs, boxplots, corrélations et analyses SHAP pour explorer et interpréter vos modèles.",             color: "from-teal-500 to-emerald-400" },
  { icon: Shield,    title: "Sécurité Médicale",        description: "Protection des données conforme aux normes RGPD et HDS. Chiffrement de bout en bout pour vos données sensibles.",        color: "from-violet-500 to-purple-400"},
  { icon: Zap,       title: "Temps Réel",               description: "Entraînement rapide, prédictions instantanées et monitoring des métriques en direct pour un workflow optimisé.",         color: "from-amber-500 to-orange-400" },
  { icon: TrendingUp,title: "Résultats Exportables",    description: "Rapports PDF détaillés, métriques de performance et comparaison de modèles pour valider et partager vos résultats.",    color: "from-pink-500 to-rose-400"   },
];

const pipeline = [
  { step: '01', icon: Upload,       label: 'Import',       desc: 'CSV, Excel, images DICOM'          },
  { step: '02', icon: Database,     label: 'Exploration',  desc: 'Analyse & visualisation'            },
  { step: '03', icon: FlaskConical, label: 'Préparation',  desc: 'Nettoyage & feature engineering'   },
  { step: '04', icon: Cpu,          label: 'Entraînement', desc: 'AutoML & sélection de modèles'     },
  { step: '05', icon: TrendingUp,   label: 'Prédiction',   desc: 'Inférence & rapport exportable'    },
];

const testimonials = [
  { name: "Dr. Sophie Martin",  role: "Cardiologue, CHU Paris",          content: "MedIQ a transformé notre approche diagnostique. La précision des prédictions nous permet d'agir plus rapidement.", avatar: "SM", rating: 5 },
  { name: "Prof. Jean Dubois",  role: "Chef de service, Institut Pasteur", content: "L'interface intuitive et la puissance des algorithmes font de cette plateforme un outil indispensable pour la recherche.", avatar: "JD", rating: 5 },
  { name: "Dr. Marie Laurent",  role: "Oncologue, Gustave Roussy",        content: "Grâce à MedIQ, nous avons réduit de 40 % le temps d'analyse de nos données patients.",                           avatar: "ML", rating: 5 },
];

const statsData = [
  { target: 98,  suffix: '%', label: 'Précision IA'   },
  { target: 500, suffix: '+', label: 'Médecins'        },
  { target: 50,  suffix: '+', label: 'Hôpitaux'        },
  { target: 1,   suffix: 'M+',label: 'Prédictions'     },
];

/* ─────────────────────────────── sub-components ─────────────────────────────── */

function StatCounter({ target, suffix, label }: { target: number; suffix: string; label: string }) {
  const { count, ref } = useCountUp(target, 2.2);
  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl lg:text-5xl font-extrabold text-gradient-premium tabular-nums">
        {count}{suffix}
      </div>
      <div className="text-sm text-muted-foreground mt-1 font-medium">{label}</div>
    </div>
  );
}

/* Floating orbs background */
function OrbField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute rounded-full bg-primary/25 blur-3xl"
        style={{ width: 500, height: 500, top: '-10%', left: '-8%' }}
        animate={{ x: [0, 30, 0], y: [0, 20, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full bg-secondary/20 blur-3xl"
        style={{ width: 400, height: 400, bottom: '0%', right: '-5%' }}
        animate={{ x: [0, -25, 0], y: [0, -15, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full bg-accent/15 blur-3xl"
        style={{ width: 300, height: 300, top: '50%', left: '40%' }}
        animate={{ x: [0, 20, 0], y: [0, -30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/* Mock dashboard card that floats in the hero */
function DashboardMock() {
  return (
    <TiltCard className="relative w-full max-w-[480px] mx-auto">
      <div
        className="rounded-2xl overflow-hidden glass-premium shadow-glow border border-primary/20"
        style={{ transform: 'translateZ(0)' }}
      >
        {/* Topbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-card/50">
          <div className="w-3 h-3 rounded-full bg-rose-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
          <span className="ml-3 text-xs text-muted-foreground font-mono">MedIQ — Dashboard</span>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 bg-card/60">
          {/* Metric row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Précision', value: '97.4%', color: 'text-emerald-500' },
              { label: 'F1-Score',  value: '0.961', color: 'text-blue-400'   },
              { label: 'AUC-ROC',   value: '0.993', color: 'text-violet-400' },
            ].map((m) => (
              <div key={m.label} className="rounded-xl p-3 bg-muted/40 border border-border/30">
                <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Mini bar chart */}
          <div className="rounded-xl p-4 bg-muted/30 border border-border/30">
            <div className="text-xs text-muted-foreground mb-3 font-medium">Distribution des prédictions</div>
            <div className="flex items-end gap-1.5 h-16">
              {[45, 72, 58, 90, 67, 82, 55, 78, 61, 95, 70, 88].map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 rounded-sm bg-gradient-to-t from-primary to-secondary opacity-80"
                  style={{ height: `${h}%` }}
                  initial={{ scaleY: 0, originY: 1 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 0.6 + i * 0.05, duration: 0.5, ease: 'backOut' }}
                />
              ))}
            </div>
          </div>

          {/* Progress lines */}
          {[
            { label: 'Random Forest', pct: 94 },
            { label: 'XGBoost',       pct: 97 },
            { label: 'Neural Net',    pct: 89 },
          ].map((m) => (
            <div key={m.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{m.label}</span>
                <span className="font-semibold text-primary">{m.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                  initial={{ width: 0 }}
                  animate={{ width: `${m.pct}%` }}
                  transition={{ delay: 0.8, duration: 1, ease: 'easeOut' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating badge */}
      <motion.div
        className="absolute -top-4 -right-4 px-3 py-1.5 rounded-full glass-premium border border-emerald-500/30 flex items-center gap-1.5 shadow-lg"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-semibold text-emerald-500">Modèle actif</span>
      </motion.div>

      <motion.div
        className="absolute -bottom-4 -left-4 px-3 py-1.5 rounded-full glass-premium border border-blue-500/30 flex items-center gap-1.5 shadow-lg"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      >
        <Sparkles className="w-3 h-3 text-blue-400" />
        <span className="text-xs font-semibold text-blue-400">Prédiction IA</span>
      </motion.div>
    </TiltCard>
  );
}

/* ─────────────────────────────── main page ─────────────────────────────── */

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-hidden font-sans">

      {/* ── Grid texture overlay ── */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* ── Navbar ── */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'glass-premium shadow-lg border-b border-border/30' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-glow-sm">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">MedIQ</span>
            </div>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-8 text-sm">
              {['Fonctionnalités','Pipeline','Témoignages'].map((label, i) => (
                <a
                  key={i}
                  href={`#${['features','pipeline','testimonials'][i]}`}
                  className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                  {label}
                </a>
              ))}
            </div>

            {/* CTA */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
                <Link to="/login">Connexion</Link>
              </Button>
              <Button size="sm" variant="premium" asChild className="shadow-glow-sm">
                <Link to="/signup" className="flex items-center gap-1.5">
                  Commencer <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
              <button
                className="md:hidden text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen(v => !v)}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-premium border-t border-border/30 px-4 py-4 flex flex-col gap-3 text-sm"
          >
            {['Fonctionnalités','Pipeline','Témoignages'].map((label, i) => (
              <a
                key={i}
                href={`#${['features','pipeline','testimonials'][i]}`}
                onClick={() => setMobileOpen(false)}
                className="text-muted-foreground hover:text-foreground font-medium py-1"
              >
                {label}
              </a>
            ))}
            <Link to="/login" className="text-muted-foreground hover:text-foreground font-medium py-1">Connexion</Link>
          </motion.div>
        )}
      </motion.nav>

      {/* ────────────────── HERO ────────────────── */}
      <section className="relative min-h-screen flex items-center pt-20 pb-16 overflow-hidden">
        <OrbField />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left */}
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
            >
              {/* Badge */}
              <motion.div
                variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.6 } } }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 mb-6"
              >
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-semibold text-primary">Plateforme IA Médicale · v2.0</span>
              </motion.div>

              {/* Heading */}
              <motion.h1
                variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } } }}
                className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6"
              >
                L'IA qui{' '}
                <span className="relative inline-block">
                  <span className="text-gradient-premium">révolutionne</span>
                  <motion.span
                    className="absolute -bottom-1 left-0 h-[3px] rounded-full bg-gradient-to-r from-primary to-secondary"
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ delay: 0.9, duration: 0.8, ease: 'easeOut' }}
                  />
                </span>
                <br />la médecine
              </motion.h1>

              {/* Sub */}
              <motion.p
                variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.6 } } }}
                className="text-lg sm:text-xl text-muted-foreground max-w-xl mb-8 leading-relaxed"
              >
                Analysez vos données médicales, entraînez des modèles sur mesure et obtenez des prédictions fiables —
                sans écrire une seule ligne de code.
              </motion.p>

              {/* CTAs */}
              <motion.div
                variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.6 } } }}
                className="flex flex-col sm:flex-row gap-3 mb-10"
              >
                <Button size="lg" variant="premium" asChild className="text-base px-7 py-5 shadow-glow group">
                  <Link to="/signup" className="flex items-center gap-2">
                    Démarrer gratuitement
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="text-base px-7 py-5 group">
                  <Link to="/login" className="flex items-center gap-2">
                    <Play className="w-4 h-4 fill-current" />
                    Voir la démo
                  </Link>
                </Button>
              </motion.div>

              {/* Trust row */}
              <motion.div
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.6, delay: 0.2 } } }}
                className="flex flex-wrap gap-5 text-sm text-muted-foreground"
              >
                {['Essai 14 jours gratuit', 'Sans carte bancaire', 'RGPD conforme'].map((t) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>{t}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right — 3D Dashboard */}
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:flex justify-center"
            >
              <DashboardMock />
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-muted-foreground/50"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-muted-foreground/40 to-transparent" />
          <span className="text-[10px] tracking-widest uppercase">Scroll</span>
        </motion.div>
      </section>

      {/* ────────────────── STATS ────────────────── */}
      <section className="py-16 relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
            {statsData.map((s) => (
              <StatCounter key={s.label} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── FEATURES ────────────────── */}
      <section id="features" className="py-24 lg:py-32 relative">
        <div className="absolute inset-0 gradient-subtle opacity-50" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16 max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4 text-xs font-semibold text-primary uppercase tracking-wider">
              Fonctionnalités
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold mb-4">
              Tout ce dont vous avez{' '}
              <span className="text-gradient-premium">besoin</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Une suite complète d'outils pour transformer vos données médicales en valeur clinique.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <TiltCard className="h-full">
                  <div className="h-full p-6 lg:p-7 rounded-2xl glass-premium border border-border/30 card-hover group relative overflow-hidden">
                    {/* subtle glow on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl" />

                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <f.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold mb-2 relative z-10">{f.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed relative z-10">{f.description}</p>

                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300 relative z-10">
                      En savoir plus <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── PIPELINE ────────────────── */}
      <section id="pipeline" className="py-24 lg:py-32 relative overflow-hidden">
        <OrbField />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 mb-4 text-xs font-semibold text-secondary uppercase tracking-wider">
              Pipeline
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold mb-4">
              De la donnée brute au{' '}
              <span className="text-gradient-premium">résultat clinique</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Un flux guidé, étape par étape, conçu pour les cliniciens comme pour les chercheurs.
            </p>
          </motion.div>

          {/* Steps */}
          <div className="relative">
            {/* Connector line */}
            <div className="hidden lg:block absolute top-12 left-0 right-0 h-px">
              <motion.div
                className="h-full bg-gradient-to-r from-primary/40 via-secondary/40 to-accent/40"
                initial={{ scaleX: 0, originX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-8 relative z-10">
              {pipeline.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex flex-col items-center text-center gap-4"
                >
                  <div className="relative">
                    <div className="w-24 h-24 rounded-2xl glass-premium border border-border/40 flex items-center justify-center shadow-premium group hover:border-primary/40 transition-colors duration-300">
                      <step.icon className="w-9 h-9 text-primary" />
                    </div>
                    <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-[10px] font-bold text-white shadow-glow-sm">
                      {step.step}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-base mb-1">{step.label}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">{step.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── TESTIMONIALS ────────────────── */}
      <section id="testimonials" className="py-24 lg:py-32 relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-4 text-xs font-semibold text-accent uppercase tracking-wider">
              Témoignages
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold mb-4">
              Ils nous font{' '}
              <span className="text-gradient-premium">confiance</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Des professionnels de santé de toute la France utilisent MedIQ au quotidien.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
              >
                <TiltCard className="h-full">
                  <div className="h-full p-6 lg:p-8 rounded-2xl glass-premium border border-border/30 relative overflow-hidden flex flex-col">
                    {/* quote mark */}
                    <div className="absolute top-4 right-6 text-7xl font-serif text-primary/10 leading-none select-none">"</div>

                    <div className="flex gap-0.5 mb-4">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-gold-500 text-gold-500" />
                      ))}
                    </div>

                    <p className="text-foreground/90 leading-relaxed mb-6 flex-1 relative z-10 text-sm">
                      "{t.content}"
                    </p>

                    <div className="flex items-center gap-3 relative z-10 mt-auto">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-glow-sm">
                        {t.avatar}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.role}</div>
                      </div>
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── CTA ────────────────── */}
      <section className="py-24 lg:py-32 relative overflow-hidden">
        <OrbField />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            {/* Premium border wrapper */}
            <div className="relative p-px rounded-3xl bg-gradient-to-br from-primary/60 via-secondary/40 to-accent/60">
              <div className="relative rounded-[calc(1.5rem-1px)] p-10 lg:p-16 text-center glass-premium overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-secondary/8" />

                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6 text-xs font-semibold text-primary uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    Commencez aujourd'hui
                  </div>

                  <h2 className="text-3xl lg:text-5xl font-extrabold mb-4">
                    Prêt à transformer<br />
                    <span className="text-gradient-premium">vos données médicales ?</span>
                  </h2>

                  <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
                    Rejoignez plus de 500 professionnels de santé qui améliorent leurs diagnostics grâce à l'IA.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                    <Button size="lg" variant="premium" asChild className="text-base px-8 py-5 shadow-glow group">
                      <Link to="/signup" className="flex items-center gap-2">
                        Démarrer gratuitement
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild className="text-base px-8 py-5">
                      <Link to="/login">Se connecter</Link>
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
                    {['14 jours gratuits', 'Sans carte bancaire', 'Support inclus'].map((t) => (
                      <div key={t} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ────────────────── FOOTER ────────────────── */}
      <footer className="border-t border-border/60 py-12 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-glow-sm">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg">MedIQ</span>
            </div>

            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              {['Mentions légales', 'Confidentialité', 'Contact'].map((l) => (
                <a key={l} href="#" className="hover:text-foreground transition-colors">{l}</a>
              ))}
            </div>

            <div className="text-sm text-muted-foreground">
              © 2025 MedIQ. Tous droits réservés.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
