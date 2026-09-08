"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Calculator, FileText, LayoutDashboard, LogIn, LogOut, User } from "lucide-react";

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

      if (user?.email) {
        const email = user.email.toLowerCase();
        if (email.endsWith("@cotigrafic.local") || email === "admin@graph.com") {
          setIsAdmin(true);
        }
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

        {/* Navigation Links */}
        <nav style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Link
            href="/"
            prefetch={false}
            style={{
              padding: "0.5rem 0.85rem",
              borderRadius: "var(--radius-md)",
              fontSize: "0.9rem",
              fontWeight: pathname === "/" ? 600 : 500,
              color: pathname === "/" ? "var(--accent)" : "var(--text-secondary)",
              background: pathname === "/" ? "var(--accent-light)" : "transparent",
              textDecoration: "none",
              transition: "var(--transition-fast)",
            }}
          >
            Inicio
          </Link>

          <Link
            href="/cotizar"
            prefetch={false}
            style={{
              padding: "0.5rem 0.85rem",
              borderRadius: "var(--radius-md)",
              fontSize: "0.9rem",
              fontWeight: pathname === "/cotizar" ? 600 : 500,
              color: pathname === "/cotizar" ? "var(--accent)" : "var(--text-secondary)",
              background: pathname === "/cotizar" ? "var(--accent-light)" : "transparent",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              transition: "var(--transition-fast)",
            }}
          >
            <Calculator size={16} />
            <span>Cotizador</span>
            {cartCount > 0 && (
              <span
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "0.1rem 0.45rem",
                  borderRadius: "var(--radius-full)",
                }}
              >
                {cartCount}
              </span>
            )}
          </Link>

          {user && (
            <Link
              href="/mis-cotizaciones"
              prefetch={false}
              style={{
                padding: "0.5rem 0.85rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.9rem",
                fontWeight: pathname === "/mis-cotizaciones" ? 600 : 500,
                color: pathname === "/mis-cotizaciones" ? "var(--accent)" : "var(--text-secondary)",
                background: pathname === "/mis-cotizaciones" ? "var(--accent-light)" : "transparent",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                transition: "var(--transition-fast)",
              }}
            >
              <FileText size={16} />
              <span>Mis Cotizaciones</span>
            </Link>
          )}

          {isAdmin && (
            <Link
              href="/dashboard"
              prefetch={false}
              style={{
                padding: "0.5rem 0.85rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "var(--accent)",
                border: "1px solid var(--accent)",
                background: "var(--accent-light)",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                marginLeft: "0.5rem",
              }}
            >
              <LayoutDashboard size={16} />
              <span>Admin Panel</span>
            </Link>
          )}
        </nav>

        {/* User Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
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
              href="/login?redirect=/cotizar"
              prefetch={false}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "var(--text-primary)",
                color: "#fff",
                padding: "0.45rem 0.95rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.85rem",
                fontWeight: 600,
                textDecoration: "none",
                transition: "var(--transition-fast)",
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
