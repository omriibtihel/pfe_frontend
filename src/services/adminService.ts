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
  phone?: string | null;
  address?: string | null;
  date_of_birth?: string | null;
  specialty?: string | null;
  hospital?: string | null;
  profile_photo?: string | null;
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
    phone: u.phone ?? undefined,
    address: u.address ?? undefined,
    dateOfBirth: u.date_of_birth ?? undefined,
    specialty: u.specialty ?? undefined,
    hospital: u.hospital ?? undefined,
    profilePhoto: u.profile_photo ?? undefined,
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

  async getApprovedUsers(): Promise<User[]> {
    const res = await apiClient.get<BackendUser[]>("/admin/users/approved");
    return res.map(mapBackendUser);
  },

  async getRejectedUsers(): Promise<User[]> {
    const res = await apiClient.get<BackendUser[]>("/admin/users/rejected");
    return res.map(mapBackendUser);
  },

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/admin/users/${id}`);
  },

  async approveUser(id: string): Promise<void> {
    await apiClient.postJson(`/admin/users/${id}/approve`, {});
  },

  async rejectUser(id: string, reason?: string): Promise<void> {
    await apiClient.postJson(`/admin/users/${id}/reject`, { reason: reason ?? null });
  },
};

export default adminService;
