"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallback() {
  const [status, setStatus] = useState("Autenticando...");

  useEffect(() => {
    const supabase = createClient();

    async function handleCallback() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        const resolveRedirect = (email?: string) => {
          const stored = localStorage.getItem("cotigrafic_auth_redirect");
          if (stored) {
            localStorage.removeItem("cotigrafic_auth_redirect");
            return stored;
          }
          const redirectParam = params.get("redirect");
          if (redirectParam) return redirectParam;

          const lowerEmail = email?.toLowerCase() || "";
          if (lowerEmail.endsWith("@cotigrafic.local") || lowerEmail === "admin@graph.com") {
            return "/dashboard";
          }
          return "/cotizar";
        };

        // 1. Session already exists
        const {
          data: { session: existing },
        } = await supabase.auth.getSession();
        if (existing) {
          setStatus("Sesión detectada. Redirigiendo...");
          window.location.href = resolveRedirect(existing.user?.email);
          return;
        }

        // 2. PKCE code exchange
        if (code) {
          setStatus("Verificando credenciales...");
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            setStatus("Acceso confirmado. Redirigiendo...");
            window.location.href = resolveRedirect(data.user?.email);
            return;
          }
          setStatus("Error de autenticación. Redirigiendo...");
          window.location.href = "/login";
          return;
        }

        // 3. Wait for auth state change (implicit flow)
        setStatus("Esperando confirmación...");
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session) {
            subscription.unsubscribe();
            window.location.href = resolveRedirect(session.user?.email);
          }
        });

        // Timeout
        setTimeout(() => {
          subscription.unsubscribe();
          window.location.href = "/login";
        }, 8000);
      } catch (err) {
        console.error("[auth/callback] error:", err);
        window.location.href = "/login";
      }
    }

    handleCallback();
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        gap: "1.5rem",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          border: "4px solid rgba(79, 70, 229, 0.2)",
          borderTop: "4px solid var(--accent)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>{status}</p>
      <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
        CotiGrafix
      </p>
    </div>
  );
}
