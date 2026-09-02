"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Credentials state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleGoogleLogin() {
    try {
      setLoading(true);
      setError("");
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        console.error("Supabase Auth Error:", error);
        setError(error.message || "Error al iniciar sesión con Google");
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Network/Unexpected Error:", err);
      setError("Error de conexión. Intenta nuevamente.");
      setLoading(false);
    }
  }

  async function handleCredentialsLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Por favor ingresa usuario y contraseña.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const supabase = createClient();
      
      // Use fake email for Supabase under the hood
      const email = `${username.trim().toLowerCase()}@cotigrafic.local`;
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Supabase Auth Error:", error);
        setError("Usuario o contraseña incorrectos.");
        setLoading(false);
      } else {
        // Redirigir al dashboard o recargar para que el middleware lo maneje
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      console.error("Network/Unexpected Error:", err);
      setError("Error de conexión. Intenta nuevamente.");
      setLoading(false);
    }
  }

  return (
    <div className="auth-root">
      {/* Panel izquierdo */}
      <aside className="auth-panel-left">
        <div className="auth-left-brand">
          <div className="auth-left-brand-icon">📊</div>
          <span className="auth-left-brand-name">CotiGrafix</span>
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 className="auth-left-title">
            Cotizaciones <span>profesionales</span> para tu negocio gráfico.
          </h2>
          <p className="auth-left-sub">
            Gestiona tus productos, calcula costos automáticamente y genera
            cotizaciones profesionales en PDF con un solo clic.
          </p>

          <div className="auth-left-features">
            {[
              { icon: "✓", text: "Cálculo automático de costos" },
              { icon: "✓", text: "Exportación a PDF y Excel" },
              { icon: "✓", text: "Historial de cotizaciones por cliente" },
              { icon: "✓", text: "Catálogo visual de servicios" },
            ].map((f) => (
              <div key={f.text} className="auth-left-feature">
                <div className="auth-left-feature-dot">{f.icon}</div>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-left-footer">
          © {new Date().getFullYear()} CotiGrafix — Sistema de Cotizaciones
        </div>
      </aside>

      {/* Panel derecho — Login */}
      <div className="auth-panel-right">
        <div className="auth-card">
          <div style={{ marginBottom: "2rem" }}>
            <div
              style={{
                width: 48,
                height: 48,
                background: "var(--accent-gradient)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4rem",
                marginBottom: "1.25rem",
              }}
            >
              📊
            </div>
            <h1 style={{ fontSize: "1.55rem", margin: "0 0 6px" }}>
              Bienvenido a CotiGrafix
            </h1>
            <p className="subtitle" style={{ margin: 0 }}>
              Ingresa al sistema de cotizaciones.
            </p>
          </div>

          {error && <div className="msg-err">{error}</div>}

          <form onSubmit={handleCredentialsLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. admin"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid var(--surface-divider)",
                  background: "var(--surface)",
                  color: "var(--text-main)",
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid var(--surface-divider)",
                  background: "var(--surface)",
                  color: "var(--text-main)",
                  outline: "none",
                }}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                marginTop: "0.5rem",
                width: "100%",
              }}
            >
              {loading ? "Conectando..." : "Ingresar"}
            </button>
          </form>

          <div style={{
            display: "flex",
            alignItems: "center",
            margin: "1.5rem 0",
            color: "var(--text-muted)",
            fontSize: "0.85rem"
          }}>
            <div style={{ flex: 1, height: "1px", background: "var(--surface-divider)" }} />
            <span style={{ padding: "0 10px" }}>O</span>
            <div style={{ flex: 1, height: "1px", background: "var(--surface-divider)" }} />
          </div>

          <button
            type="button"
            className="oauth-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </button>
        </div>
      </div>
    </div>
  );
}
