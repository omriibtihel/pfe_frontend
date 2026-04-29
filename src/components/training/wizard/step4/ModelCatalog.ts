import { Brain, BarChart3, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ModelType, GridScoringOption } from "@/types";

export type ModelCatalogEntry = {
  value: ModelType;
  label: string;
  desc: string;
  clinicalTip: string;
  Icon: LucideIcon;
  supportedTasks?: string[];
};

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    value: "randomforest",
    label: "Forêt Aléatoire",
    desc: "Excellent point de départ — robuste aux données bruitées",
    clinicalTip: "Combine 100+ arbres de décision qui « votent » ensemble, comme un comité d'experts. Très résistant aux valeurs aberrantes. Indique quelles variables biologiques ont le plus influencé la prédiction. Recommandé pour commencer.",
    Icon: Brain,
  },
  {
    value: "extratrees",
    label: "Extra Trees",
    desc: "Version rapide de la Forêt Aléatoire",
    clinicalTip: "Identique à la Forêt Aléatoire mais entraîné plus rapidement. Légèrement moins précis sur petits datasets. Utile quand le temps d'entraînement est long.",
    Icon: Brain,
  },
  {
    value: "xgboost",
    label: "XGBoost",
    desc: "Très performant sur données cliniques structurées",
    clinicalTip: "Construit des arbres successifs, chacun corrigeant les erreurs du précédent. Souvent le plus précis sur des données tabulaires (biologie, scores cliniques). Largement utilisé dans les études médicales publiées.",
    Icon: Sparkles,
  },
  {
    value: "lightgbm",
    label: "LightGBM",
    desc: "Même précision que XGBoost, entraînement plus rapide",
    clinicalTip: "Variante optimisée de XGBoost pour les grandes bases de données (>10 000 patients). À préférer quand l'entraînement prend trop de temps.",
    Icon: Zap,
  },
  {
    value: "catboost",
    label: "CatBoost",
    desc: "Idéal pour variables textuelles (sexe, diagnostic, groupe)",
    clinicalTip: "Gère nativement les variables catégorielles (ex : sexe, groupe sanguin, statut tabagique) sans transformation préalable. Moins sensible au prétraitement.",
    Icon: Sparkles,
  },
  {
    value: "gradientboosting",
    label: "Gradient Boosting",
    desc: "Alternative stable à XGBoost",
    clinicalTip: "Même principe que XGBoost mais version classique, bien documentée et stable. Plus lent mais fiable. Bon choix si XGBoost donne des résultats instables.",
    Icon: BarChart3,
  },
  {
    value: "svm",
    label: "SVM",
    desc: "Efficace sur petites cohortes (<2 000 patients)",
    clinicalTip: "Cherche la frontière optimale entre les classes (malade/sain). Très performant quand les données sont peu nombreuses et bien séparables. Moins adapté aux grandes bases.",
    Icon: Brain,
  },
  {
    value: "knn",
    label: "K Plus Proches Voisins",
    desc: "Diagnostic par analogie avec des cas similaires",
    clinicalTip: "Prédit en cherchant les patients les plus similaires dans la base d'entraînement : « les 5 patients les plus proches avaient ce diagnostic ». Simple mais peut être lent sur grandes bases.",
    Icon: Brain,
  },
  {
    value: "mlp",
    label: "Réseau de Neurones (MLP)",
    desc: "Réseau multicouche — classification et régression",
    clinicalTip: "Réseau de neurones artificiel classique (perceptron multicouche). Peut modéliser des relations non-linéaires complexes entre variables biologiques. Bon complément aux arbres de décision. Nécessite une normalisation des données et plus de données qu'un modèle linéaire.",
    Icon: Sparkles,
  },
  {
    value: "naivebayes",
    label: "Naive Bayes",
    desc: "Rapide et robuste — idéal pour petits datasets",
    clinicalTip: "Basé sur le théorème de Bayes : calcule la probabilité de chaque diagnostic en supposant que les variables sont indépendantes. Très rapide à entraîner, performant sur de petits datasets médicaux. Moins précis quand les variables sont fortement corrélées entre elles.",
    Icon: Brain,
  },
  {
    value: "decisiontree",
    label: "Arbre de Décision",
    desc: "Règles lisibles pas à pas — idéal pour l'audit clinique",
    clinicalTip: "Produit des règles explicites du type « Si Valeur A > X et Valeur B < Y → Diagnostic Z ». Le seul modèle dont un clinicien peut suivre le raisonnement. Recommandé si l'explicabilité réglementaire est prioritaire. Moins précis que les ensembles.",
    Icon: Brain,
  },
  {
    value: "logisticregression",
    label: "Régression Logistique",
    desc: "Score de risque interprétable — gold standard médical",
    clinicalTip: "Calcule une probabilité à partir de chaque variable avec un coefficient lisible. Standard dans les scores cliniques (Framingham, GRACE, CHA₂DS₂-VASc). Chaque coefficient indique l'impact de chaque variable. Recommandé quand la transparence est critique.",
    Icon: BarChart3,
  },
  {
    value: "elasticnet",
    label: "ElasticNet",
    desc: "Régression L1+L2 — sélection de variables + régularisation",
    clinicalTip: "Combine Ridge (L2) et Lasso (L1) : réduit les coefficients et peut en annuler certains. Idéal pour des données avec de nombreuses variables corrélées (biomarqueurs, scores biologiques multiples). Régression uniquement.",
    Icon: BarChart3,
    supportedTasks: ["regression"],
  },
  {
    value: "lasso",
    label: "Lasso",
    desc: "Régression avec sélection automatique de variables (L1)",
    clinicalTip: "Met les coefficients des variables non-informatives exactement à zéro → sélection automatique des variables les plus pertinentes. Très utile quand peu de biomarqueurs parmi beaucoup sont réellement prédictifs. Régression uniquement.",
    Icon: BarChart3,
    supportedTasks: ["regression"],
  },
  {
    value: "ridge",
    label: "Ridge Regression",
    desc: "Régression L2 — stabilise les coefficients sur variables corrélées",
    clinicalTip: "Linear regression with L2 regularisation. Shrinks coefficients toward zero without eliminating them — well suited for datasets with many correlated features. Unlike Lasso, Ridge keeps all variables in the model. Régression uniquement.",
    Icon: BarChart3,
    supportedTasks: ["regression"],
  },
];

export const GRID_SCORING_OPTIONS: Array<{ value: GridScoringOption; label: string; desc: string }> = [
  { value: "auto",              label: "Auto (recommandé)",                    desc: "Le système choisit la métrique la plus adaptée à vos données" },
  { value: "roc_auc",          label: "Capacité discriminante (ROC AUC)",      desc: "Mesure la capacité à séparer malades/sains — bon choix général" },
  { value: "average_precision", label: "Détection de cas rares (PR AUC)",     desc: "Recommandé si la maladie est rare — moins trompé par le déséquilibre" },
  { value: "f1_weighted",      label: "Équilibre global (F1)",                 desc: "Compromis entre sensibilité et précision — bon pour multiclasse" },
  { value: "r2",               label: "Variance expliquée (R²)",               desc: "Pour les prédictions numériques uniquement (régression)" },
];
