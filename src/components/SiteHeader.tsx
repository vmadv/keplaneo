"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";

// "Qué hacer" depende del municipio, pero el header es global (vive en el
// layout raíz, por encima de /[comunidad]/[municipio]). Mientras solo hay
// un municipio piloto realmente probado, cuando el visitante no está ya
// dentro de uno concreto (portada, comunidad...) cae aquí en vez de a un
// sitio sin sentido. "Rankings" en cambio SIEMPRE lleva al selector
// genérico de ciudad (/rankings) — nunca salta directo a Sevilla por
// defecto, para no dar a entender que es la única con rankings.
const MUNICIPIO_POR_DEFECTO = { comunidad: "andalucia", municipio: "sevilla" };

export default function SiteHeader() {
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
        <Link
          href="/"
          className="font-extrabold text-lg shrink-0"
          style={{ fontFamily: "var(--font-outfit), system-ui, sans-serif" }}
        >
          Planes España
        </Link>

        <nav className="flex items-center gap-2 flex-wrap">
          <Link href="/" className="btn-secondary text-sm px-4 py-1.5">
            {t("inicio")}
          </Link>
          <Link href={base} className="btn-secondary text-sm px-4 py-1.5">
            {t("queHacer")}
          </Link>
          <Link href="/rankings" className="btn-secondary text-sm px-4 py-1.5">
            {t("listados")}
          </Link>
        </nav>

        <LanguageSwitcher />
      </div>
    </header>
  );
}
