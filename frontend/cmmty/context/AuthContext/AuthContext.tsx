"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { User, AuthContextType, AuthState } from "../../types/auth";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ACCESS_TOKEN: "smalda_access_token",
  REFRESH_TOKEN: "smalda_refresh_token",
  USER: "smalda_user",
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Load initial state from localStorage
  useEffect(() => {
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    const userJson = localStorage.getItem(STORAGE_KEYS.USER);

    if (accessToken && userJson) {
      setState({
        accessToken,
        refreshToken,
        user: JSON.parse(userJson),
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));
    
    // Mock login API call
    try {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      if (email === "admin@smalda.com" && password === "password") {
        const mockUser: User = {
          id: "1",
          email: "admin@smalda.com",
          name: "Admin User",
          role: "admin",
        };
        const accessToken = "mock_access_token_" + Date.now();
        const refreshToken = "mock_refresh_token_" + Date.now();

        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(mockUser));

        setState({
          user: mockUser,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        throw new Error("Invalid credentials");
      }
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (!state.refreshToken) return;

    try {
      // Mock refresh API call
      const newAccessToken = "mock_access_token_" + Date.now();
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
      
      setState((prev) => ({
        ...prev,
        accessToken: newAccessToken,
      }));
    } catch (error) {
      console.error("Failed to refresh token", error);
      logout();
    }
  }, [state.refreshToken, logout]);

  // Auto-refresh logic
  useEffect(() => {
    if (!state.accessToken) return;

    // In a real app, we would decode the JWT and set the timeout based on expiry
    // For this mock, we'll refresh every 15 minutes
    const refreshInterval = setInterval(() => {
      refreshAccessToken();
    }, 15 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [state.accessToken, refreshAccessToken]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
