import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/routes/ProtectedRoute";

// Landing Page
import LandingPage from "@/pages/LandingPage";

// Auth Pages
import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";

// Dashboard
import DashboardPage from "@/pages/dashboard/DashboardPage";


// Project Pages
import NewProjectPage from "@/pages/project/NewProjectPage";
import ImportPage from "@/pages/project/ImportPage";
import DatabasePage from "@/pages/project/DatabasePage";
import DataDescriptionPage from "@/pages/project/DataDescriptionPage";
import ChartsPage from "@/pages/project/ChartsPage";
import ProcessingPage from "@/pages/project/ProcessingPage";
import VersionsPage from "@/pages/project/VersionsPage";
import TrainingPage from "@/pages/project/TrainingPage";
import TrainingResultsPage from "@/pages/project/TrainingResultsPage";
import PredictionPage from "@/pages/project/PredictionPage";
import PredictionResultsPage from "@/pages/project/PredictionResultsPage";

// Admin Pages
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/projects/new" element={<ProtectedRoute><NewProjectPage /></ProtectedRoute>} />
            <Route path="/projects/:id/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
            <Route path="/projects/:id/database" element={<ProtectedRoute><DatabasePage /></ProtectedRoute>} />
            <Route path="/projects/:id/description" element={<ProtectedRoute><DataDescriptionPage /></ProtectedRoute>} />
            <Route path="/projects/:id/charts" element={<ProtectedRoute><ChartsPage /></ProtectedRoute>} />
            <Route path="/projects/:id/processing" element={<ProtectedRoute><ProcessingPage /></ProtectedRoute>} />
            <Route path="/projects/:id/versions" element={<ProtectedRoute><VersionsPage /></ProtectedRoute>} />
            <Route path="/projects/:id/training" element={<ProtectedRoute><TrainingPage /></ProtectedRoute>} />
            <Route path="/projects/:id/training/results" element={<ProtectedRoute><TrainingResultsPage /></ProtectedRoute>} />
            <Route path="/projects/:id/predict" element={<ProtectedRoute><PredictionPage /></ProtectedRoute>} />
            <Route path="/projects/:id/predict/results" element={<ProtectedRoute><PredictionResultsPage /></ProtectedRoute>} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboardPage /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
