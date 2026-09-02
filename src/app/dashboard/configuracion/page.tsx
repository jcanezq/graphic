"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { Save, Building2, Search, Upload, Image as ImageIcon, X } from "lucide-react";
import type { CompanySettings } from "@/types";
import { fetchRucData } from "@/lib/ruc";

export default function SettingsPage() {
  const supabase = createClient();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingRuc, setSearchingRuc] = useState(false);
  const [settingsId, setSettingsId] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

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
      setLogoUrl(s.logo_url || null);
    }
    setLoading(false);
  }

  async function handleRucSearch() {
    if (ruc.length !== 11) return;
    try {
      setSearchingRuc(true);
      const data = await fetchRucData(ruc);
      setCompanyName(data.razonSocial);
      setAddress(data.direccion);
      showToast("Datos de Sunat obtenidos");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSearchingRuc(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `logo-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    setUploadingLogo(true);
    
    try {
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath);

      setLogoUrl(data.publicUrl);
      showToast("Logo subido correctamente");
    } catch (error: any) {
      showToast("Error subiendo el logo: " + error.message, "error");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    setLogoUrl(null);
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
      logo_url: logoUrl,
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
            
            <div className="form-group" style={{ marginBottom: "24px" }}>
              <label>Logotipo de la Empresa</label>
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginTop: "8px" }}>
                <div style={{ 
                  width: "120px", 
                  height: "120px", 
                  borderRadius: "var(--radius-md)", 
                  border: "2px dashed var(--surface-divider)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--surface)",
                  position: "relative",
                  overflow: "hidden"
                }}>
                  {logoUrl ? (
                    <>
                      <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      <button 
                        type="button" 
                        onClick={handleRemoveLogo}
                        style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.5)", color: "white", border: "none", borderRadius: "50%", padding: 4, cursor: "pointer" }}
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <ImageIcon size={32} style={{ color: "var(--text-muted)" }} />
                  )}
                </div>
                <div>
                  <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
                    <Upload size={16} />
                    {uploadingLogo ? "Subiendo..." : "Subir Logo"}
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: "none" }} 
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                    />
                  </label>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "8px" }}>
                    Recomendado: PNG con fondo transparente. Aparecerá en tus cotizaciones PDF.
                  </p>
                </div>
              </div>
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
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    value={ruc}
                    onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="20123456789"
                    maxLength={11}
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleRucSearch}
                    disabled={searchingRuc || ruc.length !== 11}
                  >
                    {searchingRuc ? "..." : <Search size={18} />}
                  </button>
                </div>
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
