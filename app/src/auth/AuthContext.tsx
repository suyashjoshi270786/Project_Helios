import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api, ApiError } from "../lib/api";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  mustChangePassword: boolean;
};

type AuthResult = { ok: boolean; error?: string };

type ProfileFields = { name?: string; role?: string; avatarUrl?: string | null };

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  updateProfile: (fields: ProfileFields) => Promise<AuthResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .get<User>("/api/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoaded(true));
  }, []);

  async function login(email: string, password: string): Promise<AuthResult> {
    if (!email.trim() || !password.trim()) {
      return { ok: false, error: "Enter both email and password." };
    }
    try {
      const loggedInUser = await api.post<User>("/api/auth/login", { email, password });
      setUser(loggedInUser);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Could not sign in." };
    }
  }

  async function updateProfile(fields: ProfileFields): Promise<AuthResult> {
    try {
      const updatedUser = await api.patch<User>("/api/auth/profile", fields);
      setUser(updatedUser);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Could not save changes." };
    }
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
    if (!currentPassword.trim() || newPassword.trim().length < 8) {
      return { ok: false, error: "Enter your current password and a new password of at least 8 characters." };
    }
    try {
      const updatedUser = await api.post<User>("/api/auth/change-password", { currentPassword, newPassword });
      setUser(updatedUser);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Could not change your password." };
    }
  }

  function logout() {
    api.post("/api/auth/logout").finally(() => setUser(null));
  }

  // Avoid a flash of the login page while we check the session on first load.
  if (!loaded) return null;

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login, updateProfile, changePassword, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
