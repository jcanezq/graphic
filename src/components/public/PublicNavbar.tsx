"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Calculator, FileText, LayoutDashboard, LogIn, LogOut, User, Search } from "lucide-react";

export function PublicNavbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // El privilegio lo resuelve el servidor (ADMIN_EMAILS nunca llega al navegador).
      // Esto es solo presentación: la autorización real vive en el middleware y en cada handler.
      if (!user) {
        setIsAdmin(false);
        return;
      }
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const me = await res.json();
        setIsAdmin(Boolean(me?.isAdmin));
      } catch {
        setIsAdmin(false);
      }
    }
    checkAuth();

    // Check draft count in localStorage
    function updateCartCount() {
      try {
        const draft = localStorage.getItem("cotigrafic_quote_items");
        if (draft) {
          const items = JSON.parse(draft);
          setCartCount(Array.isArray(items) ? items.length : 0);
        } else {
          setCartCount(0);
        }
      } catch {
        setCartCount(0);
      }
    }

    updateCartCount();
    window.addEventListener("storage", updateCartCount);
    window.addEventListener("cotigrafic_cart_updated", updateCartCount);

    return () => {
      window.removeEventListener("storage", updateCartCount);
      window.removeEventListener("cotigrafic_cart_updated", updateCartCount);
    };
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    window.location.href = "/";
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(12px)",
        backgroundColor: "rgba(255, 255, 255, 0.85)",
        borderBottom: "1px solid var(--surface-border)",
        transition: "var(--transition-base)",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0.85rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        {/* Brand */}
        <Link
          href="/"
          prefetch={false}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.65rem",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-md)",
              background: "var(--accent-gradient)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: "1.1rem",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            📊
          </div>
          <div>
            <span style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
              Coti<span style={{ color: "var(--accent)" }}>Grafix</span>
            </span>
            <span
              style={{
                display: "block",
                fontSize: "0.65rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              Cotizador Gráfico Online
            </span>
          </div>
        </Link>

        {/* Search Bar (DIS-T5) */}
        <form
          action="/"
          method="GET"
          style={{
            flex: 1,
            display: "flex",
            margin: "0 1.5rem",
            maxWidth: "600px",
          }}
          className="navbar-search"
        >
          <input
            type="text"
            name="q"
            placeholder="Buscar productos..."
            style={{
              flex: 1,
              height: "40px",
              borderRadius: "20px 0 0 20px",
              border: "2px solid #191919",
              borderRight: "none",
              padding: "0 16px",
              outline: "none",
              fontSize: "14px",
            }}
          />
          <button
            type="submit"
            style={{
              height: "40px",
              padding: "0 24px",
              borderRadius: "0 20px 20px 0",
              background: "#191919",
              color: "#ffffff",
              border: "2px solid #191919",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Search size={18} />
          </button>
        </form>

        {/* User Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              {isAdmin && (
                <Link
                  href="/dashboard"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    fontSize: "0.85rem",
                    color: "var(--text-primary)",
                    fontWeight: 600,
                    textDecoration: "none",
                    background: "var(--bg-tertiary)",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "var(--radius-full)",
                  }}
                >
                  <LayoutDashboard size={14} />
                  <span>Panel</span>
                </Link>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  background: "var(--bg-tertiary)",
                  padding: "0.35rem 0.75rem",
                  borderRadius: "var(--radius-full)",
                }}
              >
                <User size={14} />
                <span style={{ maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.user_metadata?.full_name || user.email?.split("@")[0]}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                title="Cerrar sesión"
                style={{
                  background: "transparent",
                  border: "1px solid var(--surface-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.4rem 0.6rem",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  fontSize: "0.8rem",
                }}
              >
                <LogOut size={14} />
                <span style={{ display: "none" }}>Salir</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              prefetch={false}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "#191919",
                color: "#fff",
                padding: "0.45rem 0.95rem",
                borderRadius: "24px",
                fontSize: "0.85rem",
                fontWeight: 700,
                textDecoration: "none",
                transition: "var(--transition-fast)",
                height: "40px",
              }}
            >
              <LogIn size={15} />
              <span>Ingresar</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
