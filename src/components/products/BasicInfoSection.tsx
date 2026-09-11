import { useState } from "react";
import Image from "next/image";
import { Upload, Image as ImageIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { UseFormRegister, Control, useWatch, UseFormSetValue } from "react-hook-form";
import type { ProductFormValues } from "@/lib/validations/product";
import type { Category } from "@/types";

interface Props {
  register: UseFormRegister<ProductFormValues>;
  control: Control<ProductFormValues>;
  setValue?: UseFormSetValue<ProductFormValues>;
  categories: Category[];
  errors: any;
  fixedType?: "Producto" | "Servicio" | "Material";
}

const UNITS = [
  { value: "m²", label: "Metro cuadrado (m²)" },
  { value: "unidad", label: "Unidad" },
  { value: "kit", label: "Kit" },
  { value: "servicio", label: "Servicio" },
  { value: "ml", label: "Metro lineal (ml)" },
  { value: "metro", label: "Metro" },
  { value: "hora-técnico / visita", label: "hora-técnico / visita" },
  { value: "m² de vehículo", label: "m² de vehículo" },
  { value: "m² instalado", label: "m² instalado" },
  { value: "m² de mueble/tabique", label: "m² de mueble/tabique" },
];

export function BasicInfoSection({ register, control, setValue, categories, errors, fixedType }: Props) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const [uploadingImage, setUploadingImage] = useState(false);

  const useManualCost = useWatch({ control, name: "useManualCost" });
  const imageUrl = useWatch({ control, name: "image_url" });

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0 || !setValue) return;
    
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `prod-${Date.now()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    setUploadingImage(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setValue("image_url", data.publicUrl, { shouldDirty: true });
      showToast("Imagen subida correctamente");
    } catch (error: any) {
      showToast("Error subiendo imagen: " + error.message, "error");
    } finally {
      setUploadingImage(false);
    }
  }

  function handleRemoveImage() {
    if (setValue) setValue("image_url", null, { shouldDirty: true });
  }

  return (
    <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
      <h3 className="card-title" style={{ marginBottom: "var(--space-md)" }}>
        Información Básica
      </h3>
      
      <div className="form-group" style={{ marginBottom: "24px" }}>
        <label>Imagen</label>
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
            {imageUrl ? (
              <>
                <Image src={imageUrl} alt="Producto" fill style={{ objectFit: "contain" }} sizes="120px" />
                <button 
                  type="button" 
                  onClick={handleRemoveImage}
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
              {uploadingImage ? "Subiendo..." : "Subir Imagen"}
              <input 
                type="file" 
                accept="image/*" 
                style={{ display: "none" }} 
                onChange={handleImageUpload}
                disabled={uploadingImage}
              />
            </label>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "8px" }}>
              Recomendado: Imagen cuadrada (JPG/PNG).
            </p>
          </div>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Código *</label>
          <input
            {...register("code", { onChange: (e) => e.target.value = e.target.value.toUpperCase() })}
            placeholder="EXH-001"
            className={errors.code ? "error" : ""}
          />
          {errors.code && <span className="error-text">{errors.code.message}</span>}
        </div>
        <div className="form-group">
          <label>Unidad de medida</label>
          <select {...register("unit")}>
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Nombre del producto/servicio *</label>
        <input
          {...register("name")}
          placeholder="Exhibidor en acrílico"
          className={errors.name ? "error" : ""}
        />
        {errors.name && <span className="error-text">{errors.name.message}</span>}
      </div>
      <div className="form-row">
        <div className="form-group" style={{ display: fixedType ? 'none' : 'block' }}>
          <label>Tipo *</label>
          <select {...register("type")}>
            <option value="Producto">Producto</option>
            <option value="Servicio">Servicio</option>
            <option value="Material">Material</option>
          </select>
        </div>
        <div className="form-group">
          <label>Categoría</label>
          <select {...register("category_id")}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Margen de utilidad (%)</label>
          <input
            type="number"
            min={0}
            max={200}
            {...register("default_margin", { valueAsNumber: true })}
          />
        </div>
      </div>
      <div className="form-group">
        <label>Descripción</label>
        <textarea
          {...register("description")}
          placeholder="Descripción detallada del producto o servicio..."
          rows={3}
        />
      </div>
      <div style={{ display: "flex", gap: "var(--space-xl)", alignItems: "center" }}>
        <label className="toggle" style={{ marginBottom: 0 }}>
          <input type="checkbox" {...register("is_active")} />
          <span className="toggle-track" />
          Activo
        </label>
        <label className="toggle" style={{ marginBottom: 0 }}>
          <input type="checkbox" {...register("useManualCost")} />
          <span className="toggle-track" />
          Costo manual
        </label>
      </div>
      {useManualCost && (
        <div className="form-group" style={{ marginTop: "var(--space-md)" }}>
          <label>Costo unitario manual (S/)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            {...register("manual_unit_cost", { valueAsNumber: true })}
            placeholder="0.00"
          />
        </div>
      )}
    </div>
  );
}
