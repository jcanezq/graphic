"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { Save, Building2 } from "lucide-react";
import type { CompanySettings } from "@/types";

export default function SettingsPage() {
  const supabase = createClient();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [ruc, setRuc] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [defaultMargin, setDefaultMargin] = useState(30);
  const [igvRate, setIgvRate] = useState(18);
  const [quotationPrefix, setQuotationPrefix] = useState("COT");
  const [nextNumber, setNextNumber] = useState(1);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const { data } = await supabase.from("company_settings").select("*").limit(1).single();
    if (data) {
      const s = data as CompanySettings;
      setSettingsId(s.id);
      setCompanyName(s.company_name);
      setRuc(s.ruc || "");
      setAddress(s.address || "");
      setPhone(s.phone || "");
      setEmail(s.email || "");
      setDefaultMargin(Number(s.default_margin));
      setIgvRate(Number(s.igv_rate) * 100);
      setQuotationPrefix(s.quotation_prefix);
      setNextNumber(s.quotation_next_number);
    }
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const updateData = {
      company_name: companyName,
      ruc: ruc || null,
      address: address || null,
      phone: phone || null,
      email: email || null,
      default_margin: defaultMargin,
      igv_rate: igvRate / 100,
      quotation_prefix: quotationPrefix,
      quotation_next_number: nextNumber,
      updated_at: new Date().toISOString(),
    };

    if (settingsId) {
      const { error } = await supabase
        .from("company_settings")
        .update(updateData)
        .eq("id", settingsId);
      if (error) {
        showToast("Error: " + error.message, "error");
      } else {
        showToast("Configuración guardada");
      }
    } else {
      const { error } = await supabase.from("company_settings").insert(updateData);
      if (error) {
        showToast("Error: " + error.message, "error");
      } else {
        showToast("Configuración creada");
        fetchSettings();
      }
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="page-body">
        <div className="skeleton" style={{ height: 400, borderRadius: 14 }} />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Configuración</h1>
          <p className="subtitle">Datos de empresa, impuestos y numeración</p>
        </div>
      </div>

      <div className="page-body">
        <form onSubmit={handleSave} style={{ maxWidth: 700 }}>
          {/* Company Info */}
          <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-md)" }}>
              <Building2 size={20} style={{ color: "var(--accent)" }} />
              <h3 className="card-title">Datos de la Empresa</h3>
            </div>
            <div className="form-group">
              <label>Nombre / Razón Social</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Mi Empresa Gráfica SAC"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>RUC</label>
                <input
                  value={ruc}
                  onChange={(e) => setRuc(e.target.value)}
                  placeholder="20123456789"
                  maxLength={11}
                />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="999 888 777"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Dirección</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Av. Ejemplo 123, Lima"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@empresa.com"
              />
            </div>
          </div>

          {/* Quotation Settings */}
          <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
            <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
              📋 Cotizaciones
            </h3>
            <div className="form-row">
              <div className="form-group">
                <label>Margen de utilidad por defecto (%)</label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={defaultMargin}
                  onChange={(e) => setDefaultMargin(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Tasa de IGV (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={igvRate}
                  onChange={(e) => setIgvRate(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Prefijo de numeración</label>
                <input
                  value={quotationPrefix}
                  onChange={(e) => setQuotationPrefix(e.target.value.toUpperCase())}
                  placeholder="COT"
                  maxLength={10}
                />
              </div>
              <div className="form-group">
                <label>Siguiente número</label>
                <input
                  type="number"
                  min={1}
                  value={nextNumber}
                  onChange={(e) => setNextNumber(Number(e.target.value))}
                />
              </div>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
              Próxima cotización: <strong>{quotationPrefix}-{new Date().getFullYear()}-{String(nextNumber).padStart(4, "0")}</strong>
            </p>
          </div>

          <button type="submit" className="btn-primary btn-lg" disabled={saving}>
            <Save size={18} />
            {saving ? "Guardando..." : "Guardar Configuración"}
          </button>
        </form>
      </div>
    </div>
  );
}
