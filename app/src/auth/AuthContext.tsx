import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api, ApiError } from "../lib/api";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
};

type AuthResult = { ok: boolean; error?: string };

type ProfileFields = { name?: string; role?: string; avatarUrl?: string | null };

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (
    name: string,
    email: string,
    password: string,
    role?: string,
    avatarUrl?: string,
  ) => Promise<AuthResult>;
  updateProfile: (fields: ProfileFields) => Promise<AuthResult>;
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

  async function register(
    name: string,
    email: string,
    password: string,
    role?: string,
    avatarUrl?: string,
  ): Promise<AuthResult> {
    if (!name.trim() || !email.trim() || !password.trim()) {
      return { ok: false, error: "Enter your name, email, and password." };
    }
    try {
      const newUser = await api.post<User>("/api/auth/register", { name, email, password, role, avatarUrl });
      setUser(newUser);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Could not create account." };
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

  function logout() {
    api.post("/api/auth/logout").finally(() => setUser(null));
  }

  // Avoid a flash of the login page while we check the session on first load.
  if (!loaded) return null;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, register, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
