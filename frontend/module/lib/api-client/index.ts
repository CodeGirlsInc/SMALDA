import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "",
});

function getToken(): string {
  return typeof localStorage !== "undefined"
    ? (localStorage.getItem("access_token") ?? "")
    : "";
}

function setToken(token: string) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("access_token", token);
  }
}

function clearToken() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("access_token");
  }
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token: string) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(original));
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
        {},
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      const newToken: string = data.access_token ?? data.token;
      setToken(newToken);
      refreshQueue.forEach((cb) => cb(newToken));
      refreshQueue = [];
      original.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(original);
    } catch {
      clearToken();
      if (typeof window !== "undefined") {
        window.location.href = "/auth/login";
      }
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);

export function get<T = unknown>(url: string, params?: Record<string, unknown>) {
  return apiClient.get<T>(url, { params }).then((r) => r.data);
}

export function post<T = unknown>(url: string, body?: unknown) {
  return apiClient.post<T>(url, body).then((r) => r.data);
}

export function patch<T = unknown>(url: string, body?: unknown) {
  return apiClient.patch<T>(url, body).then((r) => r.data);
}

export function del<T = unknown>(url: string) {
  return apiClient.delete<T>(url).then((r) => r.data);
}

export default apiClient;
