import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, api } from "../api/client";
import { setAccessToken } from "./access-token";
import { csrfToken, refreshAccessToken } from "./session";

export type User = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER" | string;
};
type AuthResponse = { accessToken: string; user: User };
type AuthStatus = "loading" | "anonymous" | "authenticated" | "denied";
type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  error: string | null;
  signInWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const NO_ACCESS = "У вас нет доступа к административной панели";
let restoreRequest: Promise<AuthResponse | null> | null = null;

async function logoutRequest() {
  const csrf = await csrfToken();
  await api<void>("/api/auth/logout", {
    method: "POST",
    skipAuth: true,
    headers: { "X-XSRF-TOKEN": csrf },
  });
}

async function restoreSession(): Promise<AuthResponse | null> {
  if (!restoreRequest) {
    restoreRequest = (async () => {
      const accessToken = await refreshAccessToken();
      const user = await api<User>("/api/auth/me", {
        skipAuth: true,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return { accessToken, user };
    })().finally(() => {
      restoreRequest = null;
    });
  }
  return restoreRequest;
}

function userMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401)
    return "Не удалось войти. Попробуйте ещё раз.";
  return "Не удалось выполнить вход. Попробуйте позже.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rejectNonAdmin = useCallback(async () => {
    setAccessToken(null);
    setUser(null);
    setStatus("denied");
    setError(NO_ACCESS);
    try {
      await logoutRequest();
    } catch {
      // The protected UI remains closed even if the server logout fails.
    }
  }, []);

  useEffect(() => {
    let active = true;
    restoreSession()
      .then(async (session) => {
        if (!active) return;
        if (!session) {
          setStatus("anonymous");
        } else if (session.user.role === "ADMIN") {
          setAccessToken(session.accessToken);
          setUser(session.user);
          setStatus("authenticated");
        } else {
          await rejectNonAdmin();
        }
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setAccessToken(null);
        if (reason instanceof ApiError && reason.status === 401) {
          setStatus("anonymous");
        } else {
          setStatus("anonymous");
          setError("Не удалось проверить сессию. Войдите ещё раз.");
        }
      });
    return () => {
      active = false;
    };
  }, [rejectNonAdmin]);

  const signInWithGoogle = useCallback(async (idToken: string) => {
    setError(null);
    try {
      const result = await api<AuthResponse>("/api/auth/google", {
        method: "POST",
        body: { idToken },
        skipAuth: true,
      });
      if (result.user?.role !== "ADMIN") {
        await rejectNonAdmin();
        return;
      }
      if (!result.accessToken) throw new Error("Invalid auth response");
      setAccessToken(result.accessToken);
      const profile = await api<User>("/api/auth/me");
      if (profile.role !== "ADMIN") {
        await rejectNonAdmin();
        return;
      }
      setUser(profile);
      setStatus("authenticated");
    } catch (reason) {
      setAccessToken(null);
      setStatus("anonymous");
      setError(userMessage(reason));
      throw reason;
    }
  }, [rejectNonAdmin]);

  const logout = useCallback(async () => {
    setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
    setError(null);
    try {
      await logoutRequest();
    } catch {
      setError("Не удалось завершить сессию. Попробуйте ещё раз.");
    }
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      error,
      signInWithGoogle,
      logout,
      clearError: () => setError(null),
    }),
    [status, user, error, signInWithGoogle, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export function getGoogleClientId() {
  return window.__APP_CONFIG__?.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
}
