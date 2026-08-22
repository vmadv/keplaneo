import Link from "next/link";

type Vigencia = "hoy" | "finde";
type Audiencia = "pareja" | "familia";

interface Combo {
  vigencia: Vigencia;
  audiencia?: Audiencia;
  label: string;
}

const COMBOS: Combo[] = [
  { vigencia: "hoy", label: "Hoy (general)" },
  { vigencia: "hoy", audiencia: "pareja", label: "Hoy en pareja" },
  { vigencia: "hoy", audiencia: "familia", label: "Hoy en familia" },
  { vigencia: "finde", label: "Este fin de semana (general)" },
  { vigencia: "finde", audiencia: "pareja", label: "Este fin de semana en pareja" },
  { vigencia: "finde", audiencia: "familia", label: "Este fin de semana en familia" },
];

function pathFor(vigencia: Vigencia, audiencia?: Audiencia) {
  const base = vigencia === "hoy" ? "hoy" : "fin-de-semana";
  return audiencia ? `${base}/${audiencia}` : base;
}

// Implementa la regla de enlazado interno del blueprint: cada página diaria
// enlaza a las otras 5 variantes del mismo municipio, para que Google las
// lea como un mismo tema bien cubierto en vez de páginas duplicadas sueltas.
export default function MunicipioPageNav({
  comunidadSlug,
  municipioSlug,
  municipioNombre,
  current,
}: {
  comunidadSlug: string;
  municipioSlug: string;
  municipioNombre: string;
  // Sin "current" (ej. en la ficha de un evento, que no es ninguna de las
  // 6 combinaciones) se muestran las 6 sin excluir ninguna.
  current?: { vigencia: Vigencia; audiencia?: Audiencia };
}) {
  const base = `/${comunidadSlug}/${municipioSlug}`;
  const otros = current
    ? COMBOS.filter((c) => !(c.vigencia === current.vigencia && c.audiencia === current.audiencia))
    : COMBOS;

  return (
    <nav aria-label={`Más planes en ${municipioNombre}`} className="mt-10 pt-8" style={{ borderTop: "2px dashed var(--border)" }}>
      <h2 className="text-lg font-extrabold mb-3">Más planes en {municipioNombre}</h2>
      <div className="flex flex-wrap gap-2">
        {otros.map((c) => (
          <Link key={c.label} href={`${base}/${pathFor(c.vigencia, c.audiencia)}`} className="btn-secondary text-sm px-4 py-2">
            {c.label}
          </Link>
        ))}
      </div>
      <p className="mt-5">
        <Link href={base} className="btn-primary">
          Ver todos los planes de {municipioNombre} →
        </Link>
      </p>
    </nav>
  );
}
