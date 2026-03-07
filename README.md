# MedicalVision Frontend

Plateforme web d'analyse de données médicales et d'entraînement de modèles de machine learning, développée dans le cadre d'un projet de fin d'études (PFE).

## Aperçu

MedicalVision est une application SaaS permettant aux professionnels de santé et aux chercheurs de :
- Importer et explorer des datasets médicaux
- Nettoyer et prétraiter les données
- Entraîner des modèles ML via un wizard guidé en 6 étapes
- Effectuer des prédictions sur de nouvelles données

## Stack technique

| Catégorie | Technologies |
|-----------|-------------|
| Framework | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui, Radix UI |
| État | React Context (auth), React Query (serveur), useState (local) |
| Formulaires | React Hook Form + Zod |
| Graphiques | Recharts |
| API | Axios (client centralisé, JWT Bearer) |
| Tests | Vitest, React Testing Library |
| Gestionnaire de paquets | Bun / npm |

## Prérequis

- Node.js >= 18 ou [Bun](https://bun.sh/)
- Backend FastAPI démarré sur `http://127.0.0.1:8000/api`

## Installation et démarrage

```bash
# Cloner le dépôt
git clone <url-du-repo>
cd medicalvision-frontend

# Installer les dépendances
bun install
# ou
npm install

# Démarrer le serveur de développement
bun run dev
# ou
npm run dev
```

L'application sera disponible sur [http://localhost:5173](http://localhost:5173).

## Scripts disponibles

```bash
bun run dev        # Démarrage en développement (HMR)
bun run build      # Build de production
bun run build:dev  # Build en mode développement
bun run preview    # Prévisualisation du build
bun run lint       # Vérification ESLint
bun run test       # Lancer les tests Vitest
```

## Structure du projet

```
src/
├── components/
│   ├── training/           # Module d'entraînement ML
│   │   ├── wizard/         # Wizard 6 étapes (Step1 → Step6)
│   │   │   └── step3/      # Sous-composants prétraitement colonnes
│   │   └── results/        # Affichage des résultats
│   ├── processing/         # Nettoyage de données
│   ├── project/            # Navigation et indicateurs projet
│   └── ui/                 # Composants shadcn/ui (60+)
├── contexts/
│   └── AuthContext.tsx     # Contexte JWT
├── hooks/                  # Hooks personnalisés
├── layouts/                # AppLayout, AuthLayout, AdminLayout
├── pages/
│   ├── project/            # Pages du workflow projet
│   ├── auth/               # Login, Signup
│   ├── dashboard/          # Tableau de bord
│   └── admin/              # Interface administrateur
├── routes/
│   ├── AppRoutes.tsx
│   └── ProtectedRoute.tsx  # Protection par rôle
├── services/               # Couche API (un fichier par domaine)
│   └── apiClient.ts        # Client Axios centralisé
└── types/                  # Types TypeScript par domaine
    └── index.ts            # Barrel export
```

## Workflow utilisateur

```
Créer un projet
    └── Importer un dataset
            └── Explorer les données (description, graphiques)
                    └── Prétraiter les données (nettoyage)
                            └── Entraîner un modèle (wizard 6 étapes)
                                    ├── Étape 1 : Dataset & variable cible
                                    ├── Étape 2 : Stratégie de split (train/test, K-fold)
                                    ├── Étape 3 : Prétraitement des colonnes
                                    ├── Étape 4 : Sélection des modèles
                                    ├── Étape 5 : Sélection des métriques
                                    └── Étape 6 : Résumé & lancement
                                            └── Résultats & Prédictions
```

## Fonctionnalités principales

### Gestion des données
- Import de fichiers CSV / connexion base de données
- Visualisation de la structure et des statistiques descriptives
- Graphiques et heatmaps de corrélation
- Gestion des versions de datasets

### Prétraitement (Processing)
- Nettoyage colonne par colonne
- Détection d'anomalies et de valeurs manquantes
- Actions en masse sur les colonnes
- Inspection détaillée avec alertes

### Entraînement ML (Wizard 6 étapes)
- Sélection de la variable cible et du dataset
- Split train/test configurable ou validation croisée K-fold
- Configuration du prétraitement par colonne (imputation, encodage, normalisation...)
- Sélection de plusieurs modèles simultanément
- Choix des métriques d'évaluation
- Suivi en temps réel de la progression
- Affichage comparatif des résultats par modèle

### Prédictions
- Interface de saisie pour nouvelles données
- Affichage et export des résultats

### Administration
- Tableau de bord administrateur
- Gestion des utilisateurs et des accès

## Architecture API

Le client Axios centralisé ([src/services/apiClient.ts](src/services/apiClient.ts)) gère :
- Injection automatique du token JWT dans les headers
- Gestion des erreurs HTTP globale
- Upload multipart (fichiers)
- Téléchargement de fichiers (blob)

Endpoint de base : `http://127.0.0.1:8000/api`

## Authentification

- JWT Bearer tokens
- Accès basé sur les rôles (User / Admin)
- Routes protégées via `ProtectedRoute`
- Contexte global `AuthContext`

## Tests

```bash
bun run test
```

Les tests sont écrits avec Vitest et React Testing Library. Les fichiers de test se trouvent à côté des fichiers source (`*.test.tsx` / `*.test.ts`).

## Contribution

1. Créer une branche depuis `main`
2. Implémenter les modifications
3. Vérifier TypeScript : `npx tsc --noEmit`
4. Vérifier le linting : `bun run lint`
5. Lancer les tests : `bun run test`
6. Ouvrir une Pull Request

## Auteur

Projet de fin d'études — 2025/2026
