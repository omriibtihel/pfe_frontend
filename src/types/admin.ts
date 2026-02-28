import type { UserRole, AccountStatus } from './user';

export interface AdminStats {
  pending_users: number;
  approved_users: number;
  rejected_users: number;
  doctors: number;
  admins: number;
}

export interface PendingUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
}
