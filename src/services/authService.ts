// src/services/authService.ts
import apiClient from "./apiClient";
import { User, LoginCredentials } from "@/types";

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
  role: string;   // "ADMIN" | "DOCTOR"
  status: string; // "APPROVED" | ...
};

type SignupPayload = {
  fullName: string;
  email: string;
  password: string;
};

function mapMeToUser(me: BackendMeResponse): User {
  // adapte selon ton type User frontend
  // ici je garde role/status en lowercase si ton front attend "admin"/"doctor"
  return {
    id: String(me.id),
    fullName: me.full_name,
    email: me.email,
    role: me.role.toLowerCase(),
    status: me.status.toLowerCase(),
    createdAt: "",
    updatedAt: "",
  } as User;
}

export const authService = {
  async signup(data: SignupPayload): Promise<{ success: boolean; message: string }> {
    const payload = {
      full_name: data.fullName,
      email: data.email,
      password: data.password,
    };

    const res = await apiClient.postJson<{ message: string }>("/auth/signup", payload);

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

  async logout(): Promise<void> {
    apiClient.clearToken();
  },
};

export default authService;
