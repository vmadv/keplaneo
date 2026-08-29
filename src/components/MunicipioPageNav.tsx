import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { hrefFiltro, type Extra } from "@/lib/filtros";

type Vigencia = "hoy" | "finde" | "semana";
type Audiencia = Extract<Extra, "pareja" | "familia">;

interface Combo {
  vigencia: Vigencia;
  audiencia?: Audiencia;
  clave: "hoyGeneral" | "hoyPareja" | "hoyFamilia" | "findeGeneral" | "findePareja" | "findeFamilia" | "estaSemana";
}

const COMBOS: Combo[] = [
  { vigencia: "hoy", clave: "hoyGeneral" },
  { vigencia: "hoy", audiencia: "pareja", clave: "hoyPareja" },
  { vigencia: "hoy", audiencia: "familia", clave: "hoyFamilia" },
  { vigencia: "finde", clave: "findeGeneral" },
  { vigencia: "finde", audiencia: "pareja", clave: "findePareja" },
  { vigencia: "finde", audiencia: "familia", clave: "findeFamilia" },
  { vigencia: "semana", clave: "estaSemana" },
];

// Implementa la regla de enlazado interno del blueprint: cada página diaria
// enlaza a las otras variantes del mismo municipio, para que Google las lea
// como un mismo tema bien cubierto en vez de páginas duplicadas sueltas.
export default async function MunicipioPageNav({
  municipioSlug,
  municipioNombre,
  current,
}: {
  municipioSlug: string;
  municipioNombre: string;
  // Sin "current" (ej. en la ficha de un evento, que no es ninguna de las
  // combinaciones) se muestran todas sin excluir ninguna.
  current?: { vigencia: Vigencia; audiencia?: Audiencia };
}) {
  const t = await getTranslations("MunicipioPageNav");
  const base = `/${municipioSlug}`;
  const otros = current
    ? COMBOS.filter((c) => !(c.vigencia === current.vigencia && c.audiencia === current.audiencia))
    : COMBOS;

  return (
    <nav aria-label={t("titulo", { municipio: municipioNombre })} className="mt-10 pt-8" style={{ borderTop: "2px dashed var(--border)" }}>
      <h2 className="text-lg font-extrabold mb-3">{t("titulo", { municipio: municipioNombre })}</h2>
      <div className="flex flex-wrap gap-2">
        {otros.map((c) => (
          <Link key={c.clave} href={hrefFiltro(base, c.vigencia, c.audiencia)} className="btn-secondary text-sm px-4 py-2">
            {t(c.clave)}
          </Link>
        ))}
      </div>
      <p className="mt-5">
        <Link href={base} className="btn-primary">
          {t("verTodos", { municipio: municipioNombre })}
        </Link>
      </p>
    </nav>
  );
}
