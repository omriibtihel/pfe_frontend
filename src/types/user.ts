export type UserRole = 'admin' | 'doctor';
export type AccountStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  specialty?: string;
  qualification?: string;
  experience?: number;
  phone?: string;
  address?: string;
  hospital?: string;
  dateOfBirth?: string;
  profilePhoto?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  fullName: string;
  specialty: string;
  qualification: string;
  experience: number;
  phone: string;
  address: string;
  hospital: string;
  dateOfBirth: string;
  profilePhoto?: File;
}

export interface AuthResponse {
  user: User;
  token: string;
}
