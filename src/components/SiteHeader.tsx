"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";
import SelectorMunicipio from "./SelectorMunicipio";

// "Qué hacer" y "Rankings" dependen del municipio, pero el header es
// global (vive en el layout raíz, por encima de /[comunidad]/[municipio]).
// MVP centrado en Sevilla y su provincia (ver conversación): quien entra
// buscando "keplaneo sevilla" espera quedarse en Sevilla en toda la
// navegación, así que ambos enlaces se quedan siempre en el municipio
// actual (o caen aquí por defecto si no hay uno en la URL) en vez de saltar
// a un selector genérico de ciudad.
const MUNICIPIO_POR_DEFECTO = { comunidad: "andalucia", municipio: "sevilla" };

export default function SiteHeader({ municipios }: { municipios: { slug: string; nombre: string }[] }) {
  const pathname = usePathname();
  const t = useTranslations("Nav");

  // /rankings/{comunidad}/{municipio}/... desplaza el comunidad/municipio
  // una posición respecto a una página de planes normal — hay que saltarse
  // el prefijo "rankings" antes de leerlos, si no "Qué hacer" apuntaría mal
  // mientras se navega dentro de esa sección.
  const segmentos = pathname.split("/").filter(Boolean);
  const esRutaTecnica = segmentos[0] === "rankings" || segmentos[0] === "negocio";
  const resto = segmentos[0] === "rankings" ? segmentos.slice(1) : segmentos;
  const [comunidadSlug, municipioSlug] =
    !esRutaTecnica && resto.length >= 2
      ? resto
      : [MUNICIPIO_POR_DEFECTO.comunidad, MUNICIPIO_POR_DEFECTO.municipio];
  const base = `/${comunidadSlug}/${municipioSlug}`;

  return (
    <header
      className="sticky top-0 z-40"
      style={{ background: "var(--background)", borderBottom: "2px solid var(--foreground)" }}
    >
      <div className="max-w-3xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
            <span
              className="font-extrabold text-lg tracking-tight"
              style={{ fontFamily: "var(--font-outfit), system-ui, sans-serif" }}
            >
              keplaneo
            </span>
          </Link>
          {municipios.length > 0 && (
            <SelectorMunicipio comunidadSlug={comunidadSlug} actual={municipioSlug} municipios={municipios} />
          )}
        </div>

        <nav className="flex items-center gap-2 flex-wrap">
          <Link href="/" className="btn-secondary text-sm px-4 py-1.5">
            {t("inicio")}
          </Link>
          <Link href={base} className="btn-secondary text-sm px-4 py-1.5">
            {t("queHacer")}
          </Link>
          <Link href={`/rankings${base}`} className="btn-secondary text-sm px-4 py-1.5">
            {t("listados")}
          </Link>
        </nav>

        <LanguageSwitcher />
      </div>
    </header>
  );
}
