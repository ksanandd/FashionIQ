"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  getUserProfileApi,
  type AuthUser,
} from "@/lib/api";
import { flushPendingInteractions } from "@/lib/interactions";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "fashioniq-token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const verifyAndLoadUser = useCallback(async (savedToken: string) => {
    try {
      const res = await getUserProfileApi(savedToken);
      if (res.success && res.profile) {
        setUser({
          user_id: res.profile.user_id,
          first_name: res.profile.first_name,
          last_name: res.profile.last_name,
          email: res.profile.email,
          role: res.profile.role,
        });
        setToken(savedToken);
        // Flush any interactions recorded while browsing anonymously
        await flushPendingInteractions();
      } else {
        throw new Error("Invalid profile response");
      }
    } catch (err) {
      console.warn("Session verification failed or expired:", err);
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedToken = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (savedToken) {
      verifyAndLoadUser(savedToken);
    } else {
      setLoading(false);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === TOKEN_KEY) {
        if (event.newValue) {
          verifyAndLoadUser(event.newValue);
        } else {
          setUser(null);
          setToken(null);
        }
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [verifyAndLoadUser]);

  const login = async (newToken: string, newUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    window.dispatchEvent(new Event("auth-changed"));
    try {
      await flushPendingInteractions();
    } catch {
      // Non-blocking
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    window.dispatchEvent(new Event("auth-changed"));
  };

  const refreshUser = async () => {
    const currentToken = token || (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);
    if (currentToken) {
      await verifyAndLoadUser(currentToken);
    }
  };

  const isAuthenticated = Boolean(user && token);
  const isAdmin = user?.role === "ADMIN";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated,
        isAdmin,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
