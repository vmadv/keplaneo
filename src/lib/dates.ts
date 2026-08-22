import { MESES, type MesSlug } from "./types";

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function mesActualSlug(): MesSlug {
  return MESES[new Date().getMonth()];
}

export function esMesSlugValido(valor: string): valor is MesSlug {
  return (MESES as readonly string[]).includes(valor);
}
