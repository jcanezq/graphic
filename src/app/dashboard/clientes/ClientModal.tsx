"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { X, Save } from "lucide-react";
import type { Client } from "@/types";
import { useRouter } from "next/navigation";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  client?: Client | null;
  onSuccess?: () => void;
}

export default function ClientModal({ isOpen, onClose, client, onSuccess }: Props) {
  const supabase = createClient();
  const { showToast } = useToast();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [ruc, setRuc] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (client) {
      setName(client.name || "");
      setRuc(client.ruc || "");
      setPhone(client.phone || "");
      setEmail(client.email || "");
      setAddress(client.address || "");
      setNotes(client.notes || "");
    } else {
      setName("");
      setRuc("");
      setPhone("");
      setEmail("");
      setAddress("");
      setNotes("");
    }
  }, [client, isOpen]);

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showToast("El nombre es obligatorio", "error");
      return;
    }
    
    setSaving(true);
    
    const payload = {
      name: name.trim(),
      ruc: ruc || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    if (client) {
      // Update
      const { error } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", client.id);

      if (error) {
        showToast("Error al actualizar: " + error.message, "error");
      } else {
        showToast("Cliente actualizado exitosamente");
        if (onSuccess) onSuccess();
        onClose();
        router.refresh();
      }
    } else {
      // Create
      const { error } = await supabase
        .from("clients")
        .insert([payload]);

      if (error) {
        showToast("Error al crear: " + error.message, "error");
      } else {
        showToast("Cliente creado exitosamente");
        if (onSuccess) onSuccess();
        onClose();
        router.refresh();
      }
    }
    setSaving(false);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2>{client ? "Editar Cliente" : "Nuevo Cliente"}</h2>
          <button className="btn-icon" onClick={onClose} disabled={saving}>
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSave} className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              Nombre o Razón Social *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="form-input"
              style={{ width: "100%" }}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                RUC / DNI
              </label>
              <input
                type="text"
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
                placeholder="11 dígitos"
                className="form-input"
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                Teléfono
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 999 888 777"
                className="form-input"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
              className="form-input"
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              Dirección
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. Principal 123"
              className="form-input"
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              Notas Internas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas visibles solo para administradores..."
              className="form-input"
              rows={3}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando..." : "Guardar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
