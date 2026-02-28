// src/services/apiClient.ts
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";

const TOKEN_KEY = "auth_token";

export type ApiErrorPayload =
  | { detail?: string | { msg?: string }[] }
  | { message?: string }
  | string
  | null
  | undefined;

function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<ApiErrorPayload>;
    const data = ax.response?.data;

    // FastAPI typical: {"detail":"..."} or {"detail":[{msg:"..."}]}
    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as any).detail;
      if (typeof detail === "string" && detail.trim()) return detail;
      if (detail && typeof detail === "object") {
        const message = (detail as any).message;
        if (typeof message === "string" && message.trim()) return message;
      }
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

    if (typeof data === "string" && data.trim()) return data;

    return ax.response?.statusText || ax.message || "Network error";
  }

  if (err instanceof Error) return err.message;
  return "Network error";
}

function parseFilenameFromContentDisposition(cd?: string): string | undefined {
  if (!cd) return undefined;
  // RFC5987: filename*=UTF-8''...
  const m1 = /filename\*\=UTF-8''([^;]+)/i.exec(cd);
  const m2 = /filename="?([^"]+)"?/i.exec(cd);
  const raw = (m1?.[1] ?? m2?.[1])?.trim();
  if (!raw) return undefined;

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export type RequestOptions = {
  /**
   * Optional AbortSignal for cancellation (useful for pagination / fast switching).
   * Example: const controller = new AbortController(); apiClient.get(url, { signal: controller.signal })
   */
  signal?: AbortSignal;
};

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

  private cfg(opts?: RequestOptions): AxiosRequestConfig {
    return opts?.signal ? { signal: opts.signal } : {};
  }

  async get<T>(url: string, opts?: RequestOptions): Promise<T> {
    try {
      const res = await this.axios.get<T>(url, this.cfg(opts));
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  async post<T>(url: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    try {
      const res = await this.axios.post<T>(url, body, this.cfg(opts));
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  async postJson<T>(url: string, body: unknown, opts?: RequestOptions): Promise<T> {
    try {
      const res = await this.axios.post<T>(
        url,
        body,
        {
          headers: { "Content-Type": "application/json" },
          ...this.cfg(opts),
        }
      );
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  async putJson<T>(url: string, body: unknown, opts?: RequestOptions): Promise<T> {
    try {
      const res = await this.axios.put<T>(
        url,
        body,
        {
          headers: { "Content-Type": "application/json" },
          ...this.cfg(opts),
        }
      );
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  async delete<T>(url: string, opts?: RequestOptions): Promise<T> {
    try {
      const res = await this.axios.delete<T>(url, this.cfg(opts));
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  async postForm<T>(url: string, body: Record<string, string>, opts?: RequestOptions): Promise<T> {
    try {
      const form = new URLSearchParams(body);
      const res = await this.axios.post<T>(
        url,
        form,
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          ...this.cfg(opts),
        }
      );
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  async postFormData<T>(url: string, body: FormData, opts?: RequestOptions): Promise<T> {
    try {
      const res = await this.axios.post<T>(
        url,
        body,
        {
          headers: { "Content-Type": "multipart/form-data" },
          ...this.cfg(opts),
        }
      );
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  // alias kept (some codebases use postMultipart)
  async postMultipart<T>(url: string, formData: FormData, opts?: RequestOptions): Promise<T> {
    return this.postFormData<T>(url, formData, opts);
  }

  async getBlob(url: string, opts?: RequestOptions): Promise<{ blob: Blob; filename?: string }> {
    try {
      const res = await this.axios.get(url, { responseType: "blob", ...this.cfg(opts) });

      const cd = (res.headers?.["content-disposition"] as string | undefined) ?? undefined;
      const filename = parseFilenameFromContentDisposition(cd);

      return { blob: res.data as Blob, filename };
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  async postFormDataBlob(
    url: string,
    body: FormData,
    opts?: RequestOptions,
  ): Promise<{ blob: Blob; filename?: string }> {
    try {
      const res = await this.axios.post(url, body, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob",
        ...this.cfg(opts),
      });
      const cd = (res.headers?.["content-disposition"] as string | undefined) ?? undefined;
      const filename = parseFilenameFromContentDisposition(cd);
      return { blob: res.data as Blob, filename };
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }
}

export const apiClient = new ApiClient();
export default apiClient;
