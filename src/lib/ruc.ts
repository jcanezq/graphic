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
  
  if (res.status === 401) {
    // El autocompletado por RUC exige sesión. El formulario sigue siendo usable a mano.
    throw new Error(
      "Inicia sesión para autocompletar con el RUC. También puedes escribir la razón social y la dirección a mano."
    );
  }

  if (res.status === 429) {
    throw new Error("Demasiadas consultas de RUC. Espera un momento e intenta de nuevo.");
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error || "Error al consultar el RUC");
  }

  return await res.json();
}
