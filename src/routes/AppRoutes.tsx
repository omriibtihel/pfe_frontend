import { ProtectedRoute } from "@/routes/ProtectedRoute";
import DashboardPage from "@/pages/DashboardPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";

<Route
  path="/dashboard"
  element={
    <ProtectedRoute roles={["DOCTOR"]}>
      <DashboardPage />
    </ProtectedRoute>
  }
/>

<Route
  path="/admin"
  element={
    <ProtectedRoute roles={["ADMIN"]}>
      <AdminDashboardPage />
    </ProtectedRoute>
  }
/>
