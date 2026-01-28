import apiClient from "./apiClient";
import { User } from "@/types";

export type AdminStats = {
  by_status: Record<string, number>; // ex: { PENDING: 2, APPROVED: 10, REJECTED: 1 }
  total_users: number;
};

type BackendUser = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  status: string;
};

function mapBackendUser(u: BackendUser): User {
  return {
    id: String(u.id),
    fullName: u.full_name,
    email: u.email,
    role: u.role.toLowerCase(),
    status: u.status.toLowerCase(),
    createdAt: "",
    updatedAt: "",
  } as User;
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
