import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// STORAGE KEYS (matching AuthContext)
const STORAGE_KEYS = {
  ACCESS_TOKEN: "smalda_access_token",
  REFRESH_TOKEN: "smalda_refresh_token",
  USER: "smalda_user",
};

// Request Interceptor: Attach Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 and Error Normalization
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const normalizedError = {
      message: "An unexpected error occurred",
      statusCode: error.response?.status || 500,
    };

    if (error.response) {
      // Handle 401 Unauthorized
      if (error.response.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.USER);
          window.location.href = "/login";
        }
      }

      // Extract message from server response if available
      const data = error.response.data as any;
      normalizedError.message = data?.message || data?.error || error.message;
    } else if (error.request) {
      normalizedError.message = "No response received from server";
    } else {
      normalizedError.message = error.message;
    }

    return Promise.reject(normalizedError);
  }
);

// Typed Helper Functions
export const get = <T>(url: string, config = {}) => 
  apiClient.get<T>(url, config).then((res) => res.data);

export const post = <T>(url: string, data = {}, config = {}) => 
  apiClient.post<T>(url, data, config).then((res) => res.data);

export const patch = <T>(url: string, data = {}, config = {}) => 
  apiClient.patch<T>(url, data, config).then((res) => res.data);

export const del = <T>(url: string, config = {}) => 
  apiClient.delete<T>(url, config).then((res) => res.data);

export default apiClient;
