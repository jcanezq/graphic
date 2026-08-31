"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

interface MobileShellProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export default function MobileShell({ sidebar, children }: MobileShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [children]);

  // Close sidebar on escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
        style={{ display: "none" }}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar overlay (mobile) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar with open class */}
      <div className={sidebarOpen ? "sidebar-open-wrapper" : ""}>
        {sidebar}
      </div>

      {children}
    </>
  );
}
