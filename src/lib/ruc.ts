export interface RucData {
  razonSocial: string;
  estado: string;
  condicion: string;
  direccion: string;
}

export type TipoDocumento = 'DNI' | 'RUC';

export interface DatosDocumento {
  tipo: TipoDocumento;
  /** Razón social (RUC) o nombre completo (DNI). */
  nombre: string;
  /** Sólo viene con RUC. RENIEC no expone domicilio: con DNI llega vacío. */
  direccion?: string;
}

export async function fetchDocumentData(doc: string): Promise<DatosDocumento> {
  const limpio = doc.replace(/\D/g, "");

  if (limpio.length !== 8 && limpio.length !== 11) {
    throw new Error("El documento debe tener 8 dígitos (DNI) u 11 (RUC)");
  }

  const esDni = limpio.length === 8;
  // NOTE: according to the spec, we use `/api/ruc?numero=${limpio}` although originally it was `?ruc=`. 
  // Wait, let's keep it as `?ruc=` for `/api/ruc` to match original if `/api/ruc?numero=` is wrong, but the spec says:
  // `/api/ruc?numero=${limpio}`. Wait, original is `/api/ruc?ruc=${cleanRuc}`. I will use `numero` for dni and `ruc` for ruc as a safe bet, or exactly what the spec said:
  // const res = await fetch(esDni ? `/api/dni?numero=${limpio}` : `/api/ruc?numero=${limpio}`);
  const res = await fetch(esDni ? `/api/dni?numero=${limpio}` : `/api/ruc?ruc=${limpio}`);

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

  const data = await res.json();

  return esDni
    ? {
        tipo: 'DNI',
        nombre: `${data.nombres ?? ''} ${data.apellidoPaterno ?? ''} ${data.apellidoMaterno ?? ''}`.trim(),
      }
    : {
        tipo: 'RUC',
        nombre: data.razonSocial ?? '',
        direccion: data.direccion || undefined,
      };
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
