// src/services/authService.ts
import apiClient from "./apiClient";
import { User, LoginCredentials, SignupData } from "@/types";

type BackendLoginResponse = {
  access_token: string;
  token_type?: string;
  role: string;   // "ADMIN" | "DOCTOR"
  status: string; // "APPROVED" | ...
  user_id: number;
};

type BackendMeResponse = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  status: string;
  profile_photo?: string | null;
  phone?: string | null;
  address?: string | null;
  date_of_birth?: string | null;
  specialty?: string | null;
  hospital?: string | null;
};

function mapMeToUser(me: BackendMeResponse): User {
  return {
    id: String(me.id),
    fullName: me.full_name,
    email: me.email,
    role: me.role.toLowerCase(),
    status: me.status.toLowerCase(),
    profilePhoto: me.profile_photo ?? undefined,
    phone: me.phone ?? undefined,
    address: me.address ?? undefined,
    dateOfBirth: me.date_of_birth ?? undefined,
    specialty: me.specialty ?? undefined,
    hospital: me.hospital ?? undefined,
    createdAt: "",
    updatedAt: "",
  } as User;
}

export const authService = {
  async signup(data: SignupData): Promise<{ success: boolean; message: string }> {
    const form = new FormData();
    form.append("full_name", data.fullName);
    form.append("email", data.email);
    form.append("password", data.password);
    if (data.phone) form.append("phone", data.phone);
    if (data.address) form.append("address", data.address);
    if (data.dateOfBirth) form.append("date_of_birth", data.dateOfBirth);
    if (data.specialty) form.append("specialty", data.specialty);
    if (data.hospital) form.append("hospital", data.hospital);
    if (data.profilePhoto) form.append("profile_photo", data.profilePhoto);

    const res = await apiClient.postMultipart<{ message: string }>("/auth/signup", form);

    return {
      success: true,
      message: res.message,
    };
  },

  async login(credentials: LoginCredentials): Promise<User> {
    // FastAPI OAuth2PasswordRequestForm expects: username, password
    const data = await apiClient.postForm<BackendLoginResponse>("/auth/login", {
      username: credentials.email,
      password: credentials.password,
    });

    apiClient.setToken(data.access_token);

    // fetch current user
    const me = await apiClient.get<BackendMeResponse>("/auth/me");
    return mapMeToUser(me);
  },

  async getCurrentUser(): Promise<User | null> {
    const token = apiClient.getToken();
    if (!token) return null;

    try {
      const me = await apiClient.get<BackendMeResponse>("/auth/me");
      return mapMeToUser(me);
    } catch {
      apiClient.clearToken();
      return null;
    }
  },

  async updateProfile(data: {
    fullName?: string;
    phone?: string;
    address?: string;
    dateOfBirth?: string;
    specialty?: string;
    hospital?: string;
    profilePhoto?: File;
  }): Promise<User> {
    const form = new FormData();
    if (data.fullName !== undefined) form.append("full_name", data.fullName);
    if (data.phone !== undefined) form.append("phone", data.phone);
    if (data.address !== undefined) form.append("address", data.address);
    if (data.dateOfBirth !== undefined) form.append("date_of_birth", data.dateOfBirth);
    if (data.specialty !== undefined) form.append("specialty", data.specialty);
    if (data.hospital !== undefined) form.append("hospital", data.hospital);
    if (data.profilePhoto) form.append("profile_photo", data.profilePhoto);

    const me = await apiClient.putFormData<BackendMeResponse>("/auth/me", form);
    return mapMeToUser(me);
  },

  async logout(): Promise<void> {
    apiClient.clearToken();
  },
};

export default authService;
