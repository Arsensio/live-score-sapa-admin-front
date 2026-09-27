import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { getGoogleClientId, useAuth } from "../../shared/auth/auth-context";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            ux_mode: "popup";
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme: string;
              size: string;
              shape: string;
              width: number;
              text: "signin_with";
            },
          ) => void;
        };
      };
    };
  }
}

const GIS_SCRIPT = "https://accounts.google.com/gsi/client";
let initializedGoogleClientId = "";
let handleGoogleCredential: ((credential: string) => void) | null = null;

export function LoginPage() {
  const { status, error, signInWithGoogle, clearError } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [setupError, setSetupError] = useState("");
  const clientId = getGoogleClientId();

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;
    let active = true;
    const render = () => {
      if (!active || !window.google || !buttonRef.current) return;
      handleGoogleCredential = (credential) => {
        if (pendingRef.current) return;
        pendingRef.current = true;
        setLoading(true);
        clearError();
        void signInWithGoogle(credential)
          .catch(() => undefined)
          .finally(() => {
            pendingRef.current = false;
            setLoading(false);
          });
      };
      if (initializedGoogleClientId !== clientId) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "popup",
          callback: ({ credential }) => handleGoogleCredential?.(credential),
        });
        initializedGoogleClientId = clientId;
      }
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        shape: "rectangular",
        width: Math.min(buttonRef.current.clientWidth || 320, 360),
        text: "signin_with",
      });
    };

    if (window.google) {
      render();
      return () => {
        active = false;
      };
    }

    let script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT}"]`);
    const created = !script;
    if (!script) {
      script = document.createElement("script");
      script.src = GIS_SCRIPT;
      script.async = true;
      script.defer = true;
    }
    const onLoad = () => render();
    const onError = () => setSetupError("Не удалось загрузить вход через Google.");
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    if (created) document.head.append(script);
    return () => {
      active = false;
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
    };
  }, [clientId, clearError, signInWithGoogle]);

  if (status === "authenticated") return <Navigate to="/tournaments" replace />;

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-mark" aria-hidden="true">T</div>
        <p className="login-eyebrow">TOUCHLINE</p>
        <h1 id="login-title">Панель администратора</h1>
        <p className="login-description">
          Войдите через Google аккаунт, которому предоставлен доступ администратора.
        </p>
        <div
          className="google-login-slot"
          ref={buttonRef}
          aria-busy={loading}
          style={loading ? { pointerEvents: "none", opacity: 0.55 } : undefined}
        />
        {loading && <p className="login-status" role="status">Выполняется вход…</p>}
        {(error || setupError || (!clientId && "Вход через Google пока не настроен.")) && (
          <p className="login-error" role="alert">{error || setupError || "Вход через Google пока не настроен."}</p>
        )}
      </section>
    </main>
  );
}
