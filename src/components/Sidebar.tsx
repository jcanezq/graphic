"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FileText,
  Settings,
  Images,
  Users,
  Layers,
  Briefcase,
} from "lucide-react";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Productos",
    href: "/dashboard/productos",
    icon: Package,
  },
  {
    label: "Servicios",
    href: "/dashboard/servicios",
    icon: Briefcase,
  },
  {
    label: "Materiales",
    href: "/dashboard/materiales",
    icon: Layers,
  },
  {
    label: "Cotizaciones",
    href: "/dashboard/cotizaciones",
    icon: FileText,
  },
  {
    label: "Clientes",
    href: "/dashboard/clientes",
    icon: Users,
  },

  {
    label: "Configuración",
    href: "/dashboard/configuracion",
    icon: Settings,
  },
];

interface SidebarProps {
  userName?: string;
  userEmail?: string;
  className?: string;
}

export default function Sidebar({ userName, userEmail, className }: SidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  return (
    <nav className={`sidebar ${className || ""}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">📊</div>
        <span className="sidebar-brand-name">CotiGrafix</span>
      </div>

      <div className="sidebar-nav">
        <div className="sidebar-section-title">Menú principal</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive(item.href) ? "active" : ""}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{userName || "Usuario"}</div>
            <div className="sidebar-user-email">{userEmail || ""}</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
