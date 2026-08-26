"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";
import SelectorMunicipio from "./SelectorMunicipio";

// "Qué hacer" y "Rankings" dependen del municipio, pero el header es
// global (vive en el layout raíz, por encima de /[municipio]). Dentro de
// una ciudad concreta, ambos enlaces se quedan en ella (ver conversación).
// Sin ciudad en contexto (portada, /elige-ciudad...) no se asume ninguna
// por defecto — el logo dice solo "keplaneo" y esos dos enlaces llevan a
// elegir ciudad, no a Sevilla a lo tonto.
//
// Fase 1 (ver conversación): planes ya vive en /{municipio}/... plano, sin
// comunidad. Rankings TODAVÍA no se ha movido (sigue en
// /rankings/{comunidad}/{municipio}/...) — se actualizará en la Fase 2.
const ANDALUCIA_SLUG = "andalucia";

export default function SiteHeader({ municipios }: { municipios: { slug: string; nombre: string }[] }) {
  const pathname = usePathname();
  const t = useTranslations("Nav");

  // El slug de municipio candidato vive en una posición distinta según el
  // árbol: en rankings (sin aplanar todavía) es el 3er segmento
  // (/rankings/{comunidad}/{municipio}); en planes es el 1º
  // (/{municipio}/...). /negocio y /elige-ciudad nunca llevan municipio en
  // la URL. Se valida contra la lista real cargada — si no coincide con
  // ningún municipio (ej. /elige-ciudad/pareja, donde "pareja" no es una
  // ciudad), cuenta como "sin ciudad en contexto".
  const segmentos = pathname.split("/").filter(Boolean);
  const candidato =
    segmentos[0] === "rankings"
      ? segmentos[2]
      : segmentos[0] === "negocio" || segmentos[0] === "elige-ciudad"
        ? undefined
        : segmentos[0];
  const municipioActual = candidato ? (municipios.find((m) => m.slug === candidato) ?? null) : null;
  const base = municipioActual ? `/${municipioActual.slug}` : null;

  const enlacesNav = (
    <>
      <Link href="/" className="btn-secondary text-sm px-4 py-1.5">
        {t("inicio")}
      </Link>
      <Link href={base ?? "/"} className="btn-secondary text-sm px-4 py-1.5">
        {t("queHacer")}
      </Link>
      <Link href={base ? `/rankings/${ANDALUCIA_SLUG}${base}` : "/rankings"} className="btn-secondary text-sm px-4 py-1.5">
        {t("listados")}
      </Link>
    </>
  );

  return (
    <header
      className="sticky top-0 z-40"
      style={{ background: "var(--background)", borderBottom: "2px solid var(--foreground)" }}
    >
      {/* Una sola fila en pantallas sm+; en móvil los enlaces bajan a una
          segunda fila propia en vez de envolver de forma desordenada entre
          el logo y las banderas. */}
      <div className="max-w-3xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Logo + selector de municipio pegados y con la misma tipografía,
              para que se lean como una sola marca ("keplaneo Sevilla" en
              cuanto hay ciudad) en vez de un logo con un filtro aparte al
              lado. Sin ciudad en contexto, el selector cae a "Ciudad". */}
          <div className="flex items-end gap-2 shrink-0">
            <Link href="/" className="flex items-center gap-1.5 leading-none">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
              <span
                className="font-extrabold text-lg tracking-tight leading-none"
                style={{ fontFamily: "var(--font-outfit), system-ui, sans-serif" }}
              >
                keplaneo
              </span>
            </Link>
            {municipios.length > 0 && (
              <SelectorMunicipio actual={municipioActual?.slug ?? null} municipios={municipios} placeholder={t("ciudad")} />
            )}
          </div>

          <nav className="hidden sm:flex items-center gap-2 flex-wrap">{enlacesNav}</nav>

          <LanguageSwitcher />
        </div>

        <nav className="flex sm:hidden items-center gap-2 flex-wrap mt-2.5">{enlacesNav}</nav>
      </div>
    </header>
  );
}
