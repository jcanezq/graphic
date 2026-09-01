import "./globals.css";
import type { Metadata } from "next";
import { ToastProvider } from "@/components/ToastProvider";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "CotiGrafix — Cotizaciones Profesionales",
  description:
    "Sistema de cotización para servicios gráficos y publicitarios. Impresión gran formato, señalética, merchandising, rotulado vehicular y más.",
  keywords: [
    "cotización",
    "servicios gráficos",
    "publicidad",
    "señalética",
    "impresión",
    "gran formato",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <Providers>
          <ToastProvider>{children}</ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
