import { redirect } from "next/navigation";

// El panel ya no tiene cotizador propio: el administrador cotiza en el circuito
// público —catálogo `/` y detalle `/cotizar`—, igual que el cliente. La ruta se
// conserva redirigiendo para que no se rompa ningún enlace guardado.
export default function NuevaCotizacionRedirect() {
  redirect("/");
}
