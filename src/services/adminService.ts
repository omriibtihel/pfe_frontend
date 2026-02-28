import apiClient from "./apiClient";
import { AccountStatus, User, UserRole } from "@/types";

export type AdminStats = {
  pending_users: number;
  approved_users: number;
  rejected_users: number;
  doctors: number;
  admins: number;
};

type BackendUser = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  status: string;
};

function toUserRole(role: string): UserRole {
  return role.toLowerCase() === "admin" ? "admin" : "doctor";
}

function toAccountStatus(status: string): AccountStatus {
  const value = status.toLowerCase();
  if (value === "approved") return "approved";
  if (value === "rejected") return "rejected";
  return "pending";
}

function mapBackendUser(u: BackendUser): User {
  return {
    id: String(u.id),
    fullName: u.full_name,
    email: u.email,
    role: toUserRole(u.role),
    status: toAccountStatus(u.status),
    createdAt: "",
    updatedAt: "",
  };
}

export const adminService = {
  async getStats(): Promise<AdminStats> {
    return await apiClient.get<AdminStats>("/admin/stats");
  },

  async getPendingUsers(): Promise<User[]> {
    const res = await apiClient.get<BackendUser[]>("/admin/users/pending");
    return res.map(mapBackendUser);
  },

  async approveUser(id: string): Promise<void> {
    await apiClient.postJson(`/admin/users/${id}/approve`, {});
  },

  async rejectUser(id: string, reason?: string): Promise<void> {
    await apiClient.postJson(`/admin/users/${id}/reject`, { reason: reason ?? null });
  },
};

export default adminService;
