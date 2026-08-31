"use client";

import { useEffect, useState } from "react";
import { EraserAddIcon } from "./icons/EraserAddIcon";
import { CLAVE_SIEMPRE, EVENTO_SIEMPRE } from "./PastillaSiempreVisual";

// El icono de "aquí también puedes filtrar" ya lo decide el servidor
// cuando el usuario elige de verdad una vigencia temporal (Hoy/Finde/Esta
// semana) frente a la fila de audiencia/precio (ver FiltrosPagina.tsx).
// "Siempre" es distinto: nunca llega `activo` real desde el servidor (ver
// PastillaSiempreVisual), así que aquí se añade la misma invitación
// también quado la marca solo en el cliente — reactiva al evento en vez de
// esperar a un recarga, porque pinchar "Siempre" no siempre navega (si ya
// estábamos en esa misma página).
export default function IconoInvitacion({ invitaServidor }: { invitaServidor: boolean }) {
  const [invitaCliente, setInvitaCliente] = useState(false);

  useEffect(() => {
    setInvitaCliente(sessionStorage.getItem(CLAVE_SIEMPRE) === "1");
    const alMarcarSiempre = () => setInvitaCliente(true);
    window.addEventListener(EVENTO_SIEMPRE, alMarcarSiempre);
    return () => window.removeEventListener(EVENTO_SIEMPRE, alMarcarSiempre);
  }, []);

  if (!invitaServidor && !invitaCliente) return null;
  return (
    <EraserAddIcon size={18} className="icono-invitacion shrink-0" style={{ color: "var(--accent)" }} aria-hidden />
  );
}
