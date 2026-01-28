import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Brain, 
  ChartLine, 
  Shield, 
  Zap, 
  Users,
  ArrowRight,
  CheckCircle2,
  Star,
  Sparkles,
  Database,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const features = [
  {
    icon: Brain,
    title: "IA Avancée",
    description: "Algorithmes de machine learning de pointe pour des prédictions précises et fiables.",
    color: "from-primary to-secondary"
  },
  {
    icon: Database,
    title: "Gestion des Données",
    description: "Importez, nettoyez et transformez vos données médicales en quelques clics.",
    color: "from-secondary to-accent"
  },
  {
    icon: ChartLine,
    title: "Visualisation Intelligente",
    description: "Graphiques interactifs pour explorer et comprendre vos données en profondeur.",
    color: "from-accent to-primary"
  },
  {
    icon: Shield,
    title: "Sécurité Maximale",
    description: "Protection des données conforme aux normes médicales les plus strictes.",
    color: "from-primary to-violet-500"
  },
  {
    icon: Zap,
    title: "Performance Optimale",
    description: "Entraînement rapide et prédictions en temps réel pour un workflow fluide.",
    color: "from-violet-500 to-secondary"
  },
  {
    icon: TrendingUp,
    title: "Résultats Mesurables",
    description: "Métriques détaillées et rapports exportables pour valider vos modèles.",
    color: "from-teal-500 to-accent"
  }
];

const testimonials = [
  {
    name: "Dr. Sophie Martin",
    role: "Cardiologue, CHU Paris",
    content: "MedicalVision a transformé notre approche diagnostique. La précision des prédictions nous permet d'agir plus rapidement.",
    avatar: "SM",
    rating: 5
  },
  {
    name: "Prof. Jean Dubois",
    role: "Chef de service, Institut Pasteur",
    content: "L'interface intuitive et la puissance des algorithmes font de cette plateforme un outil indispensable pour la recherche.",
    avatar: "JD",
    rating: 5
  },
  {
    name: "Dr. Marie Laurent",
    role: "Oncologue, Gustave Roussy",
    content: "Grâce à MedicalVision, nous avons réduit de 40% le temps d'analyse de nos données patients.",
    avatar: "ML",
    rating: 5
  }
];

const stats = [
  { value: "98%", label: "Précision IA" },
  { value: "500+", label: "Médecins" },
  { value: "1M+", label: "Prédictions" },
  { value: "50+", label: "Hôpitaux" }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navigation */}
      <motion.nav 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 glass-premium"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-glow-sm">
                <Activity className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">MedicalVision</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Fonctionnalités</a>
              <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">Témoignages</a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Tarifs</a>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link to="/login">Connexion</Link>
              </Button>
              <Button variant="premium" asChild className="hidden sm:flex">
                <Link to="/signup">
                  Commencer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative pt-32 lg:pt-40 pb-20 lg:pb-32">
        {/* Background Effects */}
        <div className="absolute inset-0 gradient-mesh-dark opacity-50" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/15 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div 
              variants={fadeInUp}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Nouvelle version 2.0 disponible</span>
            </motion.div>
            
            <motion.h1 
              variants={fadeInUp}
              className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6"
            >
              L'Intelligence Artificielle
              <br />
              <span className="text-gradient-premium">au service de la Médecine</span>
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
            >
              Analysez, entraînez et prédisez avec nos outils d'IA de pointe. 
              Transformez vos données médicales en insights actionnables.
            </motion.p>
            
            <motion.div 
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button size="lg" variant="premium" asChild className="w-full sm:w-auto text-lg px-8 py-6 shadow-glow">
                <Link to="/signup">
                  Démarrer gratuitement
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto text-lg px-8 py-6">
                <Link to="/login">
                  Voir la démo
                </Link>
              </Button>
            </motion.div>
          </motion.div>
          
          {/* Stats */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8"
          >
            {stats.map((stat, index) => (
              <div key={index} className="text-center p-6 rounded-2xl glass-premium">
                <div className="text-3xl lg:text-4xl font-bold text-gradient-premium mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-32 relative">
        <div className="absolute inset-0 gradient-subtle" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-5xl font-bold mb-4">
              Fonctionnalités <span className="text-gradient-premium">Puissantes</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Des outils conçus pour les professionnels de santé, par des experts en IA médicale.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="p-6 lg:p-8 h-full card-hover group glass-premium border-0">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 lg:py-32 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-5xl font-bold mb-4">
              Ils nous font <span className="text-gradient-premium">Confiance</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Découvrez les retours de professionnels de santé qui utilisent MedicalVision au quotidien.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
              >
                <Card className="p-6 lg:p-8 h-full glass-premium border-0 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-secondary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-gold-500 text-gold-500" />
                    ))}
                  </div>
                  
                  <p className="text-foreground mb-6 relative z-10">"{testimonial.content}"</p>
                  
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 relative">
        <div className="absolute inset-0 gradient-mesh-dark opacity-30" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center p-8 lg:p-16 rounded-3xl glass-premium shadow-glow relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
            
            <div className="relative z-10">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Prêt à transformer vos données ?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Rejoignez plus de 500 professionnels de santé qui utilisent MedicalVision pour améliorer leurs diagnostics.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" variant="premium" asChild className="text-lg px-8 py-6 shadow-glow">
                  <Link to="/signup">
                    Commencer maintenant
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
              
              <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>Essai gratuit 14 jours</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>Sans engagement</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold">MedicalVision</span>
            </div>
            
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Mentions légales</a>
              <a href="#" className="hover:text-foreground transition-colors">Confidentialité</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
            
            <div className="text-sm text-muted-foreground">
              © 2024 MedicalVision. Tous droits réservés.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
