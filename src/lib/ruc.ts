export interface RucData {
  razonSocial: string;
  estado: string;
  condicion: string;
  direccion: string;
}

export async function fetchRucData(ruc: string): Promise<RucData> {
  const cleanRuc = ruc.replace(/\D/g, "");
  if (cleanRuc.length !== 11) {
    throw new Error("El RUC debe tener 11 dígitos");
  }

  const res = await fetch(`/api/ruc?ruc=${cleanRuc}`);
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error || "Error al consultar el RUC");
  }

  return await res.json();
}
