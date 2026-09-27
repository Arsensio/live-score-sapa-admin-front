import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
type AuthStatus = "loading" | "anonymous" | "authenticated" | "denied" | "restore-error";
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


async function logoutRequest() {
  const csrf = await csrfToken();
  await api<void>("/api/auth/logout", {
    method: "POST",
    skipAuth: true,
    headers: { "X-XSRF-TOKEN": csrf },
  });
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
  const [restoreRevision, setRestoreRevision] = useState(0);
  const restoredToken = useRef<string | null>(null);
  const retryRestore = useCallback(() => setRestoreRevision(value => value + 1), []);

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
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setStatus("loading");
    setError(null);
    const restore = async () => {
      try {
        const token = restoredToken.current ?? await refreshAccessToken();
        if (!active) return;
        restoredToken.current = token;
        const profile = await api<User>("/api/auth/me", {
          skipAuth: true,
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!active) return;
        if (profile.role !== "ADMIN") {
          restoredToken.current = null;
          await rejectNonAdmin();
          return;
        }
        setAccessToken(token);
        setUser(profile);
        setStatus("authenticated");
      } catch (reason) {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) {
          restoredToken.current = null;
          setAccessToken(null);
          setUser(null);
          setStatus("anonymous");
          return;
        }
        if (++attempts < 3) {
          timer = setTimeout(() => void restore(), attempts * 1000);
          return;
        }
        setError("Не удалось восстановить соединение. Проверьте интернет и попробуйте ещё раз.");
        setStatus("restore-error");
      }
    };
    void restore();
    return () => { active = false; clearTimeout(timer); };
  }, [rejectNonAdmin, restoreRevision]);

  useEffect(() => {
    if (status !== "restore-error") return;
    window.addEventListener("online", retryRestore);
    return () => window.removeEventListener("online", retryRestore);
  }, [status, retryRestore]);

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
    restoredToken.current = null;
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
  return <AuthContext.Provider value={value}>
    {status === "loading" ? (
      <main className="auth-loading" role="status">Восстанавливаем сессию…</main>
    ) : status === "restore-error" ? (
      <main className="login-page"><section className="login-card">
        <h1>Восстановление соединения</h1>
        <p role="alert">{error}</p>
        <button type="button" className="button primary" onClick={retryRestore}>Повторить</button>
      </section></main>
    ) : children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export function getGoogleClientId() {
  return window.__APP_CONFIG__?.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
}
