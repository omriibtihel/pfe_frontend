import "@/i18n";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ProtectedRoute from "@/routes/ProtectedRoute";

// Landing Page
import LandingPage from "@/pages/LandingPage";

// Auth Pages
import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";

// Dashboard
import DashboardPage from "@/pages/dashboard/DashboardPage";

// Project Pages
import NewProjectPage from "@/pages/project/NewProjectPage";
import ImportPage from "@/pages/project/ImportPage";
import DataExplorationPage from "@/pages/project/DataExplorationPage";
import ChartsPage from "@/pages/project/ChartsPage";
import NettoyagePage from "@/pages/project/NettoyagePage";
import VersionsPage from "@/pages/project/VersionsPage";
import PreparationPage from "@/pages/project/PreparationPage";
import TrainingPage from "@/pages/project/TrainingPage";
import TrainingResultsPage from "@/pages/project/TrainingResultsPage";
import PredictionPage from "@/pages/project/PredictionPage";
import PredictionResultsPage from "@/pages/project/PredictionResultsPage";

// Admin Pages
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";

// Demo / guided tour
import DemoLayout from "@/demo/DemoLayout";
import DemoRouteGuard from "@/demo/DemoRouteGuard";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <DemoRouteGuard />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/projects/new" element={<ProtectedRoute><NewProjectPage /></ProtectedRoute>} />
            <Route path="/projects/:id/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />

            {/* Unified data exploration page */}
            <Route path="/projects/:id/database" element={<ProtectedRoute><DataExplorationPage /></ProtectedRoute>} />
            {/* Redirect old /description URL to unified page */}
            <Route path="/projects/:id/description" element={<Navigate to="../database" replace />} />

            <Route path="/projects/:id/charts" element={<ProtectedRoute><ChartsPage /></ProtectedRoute>} />
            <Route path="/projects/:id/nettoyage" element={<ProtectedRoute><NettoyagePage /></ProtectedRoute>} />
            <Route path="/projects/:id/versions" element={<ProtectedRoute><VersionsPage /></ProtectedRoute>} />
            <Route path="/projects/:id/preparation" element={<ProtectedRoute><PreparationPage /></ProtectedRoute>} />
            <Route path="/projects/:id/training" element={<ProtectedRoute><TrainingPage /></ProtectedRoute>} />
            <Route path="/projects/:projectId/versions/:versionId/training" element={<ProtectedRoute><TrainingPage /></ProtectedRoute>} />
            <Route path="/projects/:projectId/versions/:versionId/training/results" element={<ProtectedRoute><TrainingResultsPage /></ProtectedRoute>} />
            <Route path="/projects/:id/predict" element={<ProtectedRoute><PredictionPage /></ProtectedRoute>} />
            <Route path="/projects/:id/predict/results" element={<ProtectedRoute><PredictionResultsPage /></ProtectedRoute>} />

            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboardPage /></ProtectedRoute>} />

            {/* Demo / guided tour — no auth required; demoAdapter mocks the backend */}
            <Route path="/demo" element={<DemoLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="projects" element={<DashboardPage />} />
              <Route path="projects/new" element={<NewProjectPage />} />
              <Route path="projects/:id/import" element={<ImportPage />} />
              <Route path="projects/:id/database" element={<DataExplorationPage />} />
              <Route path="projects/:id/charts" element={<ChartsPage />} />
              <Route path="projects/:id/nettoyage" element={<NettoyagePage />} />
              <Route path="projects/:id/preparation" element={<PreparationPage />} />
              <Route path="projects/:id/training" element={<TrainingPage />} />
              <Route path="projects/:projectId/versions/:versionId/training" element={<TrainingPage />} />
              <Route path="projects/:projectId/versions/:versionId/training/results" element={<TrainingResultsPage />} />
              <Route path="projects/:id/predict" element={<PredictionPage />} />
              <Route path="projects/:id/predict/results" element={<PredictionResultsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
