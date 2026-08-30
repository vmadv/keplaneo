"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { traducirRutaAOtroIdioma } from "@/lib/rutasLocale";

const NOMBRES: Record<string, string> = { es: "Español", en: "English" };

// Círculo recortado con la bandera real de España (franjas rojo-amarillo-
// rojo, la amarilla el doble de ancha) — más simple que la del Reino Unido
// porque son solo franjas horizontales, no hace falta SVG.
function BanderaES() {
  return (
    <div
      className="w-full h-full rounded-full"
      style={{ background: "linear-gradient(to bottom, #AA151B 25%, #F1BF00 25%, #F1BF00 75%, #AA151B 75%)" }}
    />
  );
}

// Bandera del Reino Unido (Union Jack) real, recortada en círculo: aspa
// blanca (San Andrés) + aspa roja descentrada (San Patricio) + cruz blanca
// y roja (San Jorge) por encima, todo dentro del círculo.
function BanderaEN() {
  return (
    <svg viewBox="0 0 60 60" className="w-full h-full rounded-full" aria-hidden="true">
      <defs>
        <clipPath id="uk-circulo">
          <circle cx="30" cy="30" r="30" />
        </clipPath>
      </defs>
      <g clipPath="url(#uk-circulo)">
        <rect width="60" height="60" fill="#012169" />
        <path d="M0 0 L60 60 M60 0 L0 60" stroke="#FFFFFF" strokeWidth="13" />
        <path
          d="M0 0 L27 27 M0 3 L24 27 M60 0 L33 27 M60 3 L36 27 M0 60 L27 33 M0 57 L24 33 M60 60 L33 33 M60 57 L36 33"
          stroke="#C8102E"
          strokeWidth="4.5"
        />
        <rect x="23" width="14" height="60" fill="#FFFFFF" />
        <rect y="23" width="60" height="14" fill="#FFFFFF" />
        <rect x="26.5" width="7" height="60" fill="#C8102E" />
        <rect y="26.5" width="60" height="7" fill="#C8102E" />
      </g>
    </svg>
  );
}

const BANDERAS: Record<string, () => React.ReactElement> = { es: BanderaES, en: BanderaEN };

// Enlaza a la MISMA página en el otro idioma (usePathname de next-intl ya
// devuelve la ruta sin el prefijo /es o /en) en vez de mandar siempre a
// portada.
export default function LanguageSwitcher() {
  const pathname = usePathname();
  const localeActual = useLocale();

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Idioma / Language">
      {routing.locales.map((locale) => {
        const activo = locale === localeActual;
        const Bandera = BANDERAS[locale];
        return (
          <Link
            key={locale}
            href={traducirRutaAOtroIdioma(pathname, locale)}
            locale={locale}
            aria-label={NOMBRES[locale]}
            aria-current={activo ? "true" : undefined}
            className="block w-7 h-7 rounded-full overflow-hidden transition-transform hover:scale-110"
            style={{
              border: "2px solid var(--foreground)",
              opacity: activo ? 1 : 0.4,
            }}
          >
            <Bandera />
          </Link>
        );
      })}
    </div>
  );
}
