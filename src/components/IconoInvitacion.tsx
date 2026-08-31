"use client";

import { useEffect, useState } from "react";
import { EraserAddIcon } from "./icons/EraserAddIcon";
import { CLAVE_SIEMPRE, EVENTO_SIEMPRE } from "./PastillaSiempreVisual";

// El icono de "aquí también puedes filtrar" apunta al eje que TODAVÍA no se
// ha tocado (ver FiltrosPagina). "Siempre" marcada solo en cliente cuenta
// como "el eje Cuándo ya se ha tocado" igual que una vigencia real — si no,
// al elegir Siempre y luego una vigencia real en Filtra más (ej. En pareja)
// los dos ejes ya están "elegidos" pero el icono de Cuándo se quedaba
// mostrándose porque solo miraba el `activo` real (que SiempreHubLayout
// fuerza a false a propósito, ver filtros.ts), sin saber que el usuario ya
// había marcado Siempre visualmente.
export default function IconoInvitacion({
  eje,
  cuandoElegido,
  filtraMasElegido,
}: {
  eje: "cuando" | "filtraMas";
  cuandoElegido: boolean;
  filtraMasElegido: boolean;
}) {
  const [siempreMarcada, setSiempreMarcada] = useState(false);

  useEffect(() => {
    setSiempreMarcada(sessionStorage.getItem(CLAVE_SIEMPRE) === "1");
    const alMarcarSiempre = () => setSiempreMarcada(true);
    window.addEventListener(EVENTO_SIEMPRE, alMarcarSiempre);
    return () => window.removeEventListener(EVENTO_SIEMPRE, alMarcarSiempre);
  }, []);

  const cuandoElegidoTotal = cuandoElegido || siempreMarcada;
  const invita = eje === "cuando" ? filtraMasElegido && !cuandoElegidoTotal : cuandoElegidoTotal && !filtraMasElegido;

  if (!invita) return null;
  return (
    <EraserAddIcon size={18} className="icono-invitacion shrink-0" style={{ color: "var(--accent)" }} aria-hidden />
  );
}
