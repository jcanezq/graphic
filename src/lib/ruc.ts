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
  const res = await fetch(esDni ? `/api/dni?numero=${limpio}` : `/api/ruc?ruc=${limpio}`);

  if (res.status === 401) {
    throw new Error(
      "Inicia sesión para autocompletar con el RUC o DNI. También puedes escribir los datos a mano."
    );
  }

  if (res.status === 429) {
    throw new Error("Demasiadas consultas de RUC o DNI. Espera un momento e intenta de nuevo.");
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error || "Error al consultar el documento");
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
