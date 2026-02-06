// src/services/apiClient.ts
import axios, { AxiosInstance } from "axios";

const TOKEN_KEY = "auth_token";

export type ApiErrorPayload =
  | { detail?: string | { msg?: string }[] }
  | { message?: string }
  | string
  | null
  | undefined;

function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorPayload;

    // FastAPI typical: {"detail":"..."} or {"detail":[{msg:"..."}]}
    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as any).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail)) {
        const msg = detail.map((x: any) => x?.msg).filter(Boolean).join(", ");
        if (msg) return msg;
      }
    }

    // Other APIs: {"message":"..."}
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as any).message;
      if (typeof message === "string" && message.trim()) return message;
    }

    // Plain string payload
    if (typeof data === "string" && data.trim()) return data;

    return err.response?.statusText || err.message || "Network error";
  }

  if (err instanceof Error) return err.message;
  return "Network error";
}

class ApiClient {
  private axios: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.axios = axios.create({
      baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api",
      withCredentials: false,
      timeout: 30000,
    });

    this.axios.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) {
        config.headers = config.headers ?? ({} as any);
        (config.headers as any).Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  getToken(): string | null {
    if (!this.token) this.token = localStorage.getItem(TOKEN_KEY);
    return this.token;
  }

  clearToken() {
    this.setToken(null);
  }

  async get<T>(url: string): Promise<T> {
    try {
      const res = await this.axios.get<T>(url);
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  async post<T>(url: string, body?: unknown): Promise<T> {
    try {
      const res = await this.axios.post<T>(url, body);
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  async postJson<T>(url: string, body: unknown): Promise<T> {
    try {
      const res = await this.axios.post<T>(url, body, {
        headers: { "Content-Type": "application/json" },
      });
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  async postForm<T>(url: string, body: Record<string, string>): Promise<T> {
    try {
      const form = new URLSearchParams(body);
      const res = await this.axios.post<T>(url, form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  

  async putJson<T>(url: string, body: unknown): Promise<T> {
    try {
      const res = await this.axios.put<T>(url, body, {
        headers: { "Content-Type": "application/json" },
      });
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  async delete<T>(url: string): Promise<T> {
    try {
      const res = await this.axios.delete<T>(url);
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  async postFormData<T>(url: string, body: FormData): Promise<T> {
    try {
      const res = await this.axios.post<T>(url, body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  async postMultipart<T>(url: string, formData: FormData): Promise<T> {
    try {
      const res = await this.axios.post<T>(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  async getBlob(url: string): Promise<{ blob: Blob; filename?: string }> {
    try {
      const res = await this.axios.get(url, { responseType: "blob" });

      const cd = (res.headers?.["content-disposition"] as string | undefined) ?? undefined;

      let filename: string | undefined;
      if (cd) {
        const m1 = /filename\*\=UTF-8''([^;]+)/i.exec(cd);
        const m2 = /filename="?([^"]+)"?/i.exec(cd);
        const raw = (m1?.[1] ?? m2?.[1])?.trim();
        if (raw) filename = decodeURIComponent(raw);
      }

      return { blob: res.data as Blob, filename };
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }
}

export const apiClient = new ApiClient();
export default apiClient;
