import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import TarjetaCiudad from "@/components/TarjetaCiudad";
import { getMunicipiosConRankings } from "@/lib/queries";

export const revalidate = 86400;

const COLORES = ["var(--secondary)", "var(--tertiary)", "var(--quaternary)"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Listados");
  return { title: `${t("tituloGeneral")} | Planes España` };
}

// Punto de entrada genérico al vertical de rankings — "elige tu ciudad",
// aparte del recorrido de Planes (home > comunidad > municipio). El enlace
// "Rankings" del menú siempre trae aquí, nunca salta directo a una ciudad
// concreta por defecto, para no dar a entender que solo existe una.
export default async function RankingsHomePage() {
  const [municipios, tNav, t] = await Promise.all([
    getMunicipiosConRankings(),
    getTranslations("Nav"),
    getTranslations("Listados"),
  ]);

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Breadcrumb items={[{ label: tNav("inicio"), href: "/" }, { label: t("tituloGeneral") }]} />

        <h1 className="text-4xl font-extrabold mt-4 mb-3 text-balance">{t("tituloGeneral")}</h1>
        <p className="mb-10 text-lg" style={{ color: "var(--muted-foreground)" }}>
          {t("subtituloGeneral")}
        </p>

        {municipios.length === 0 ? (
          <p style={{ color: "var(--muted-foreground)" }}>{t("sinCiudades")}</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-5">
            {municipios.map((m, i) => (
              <li key={m.id}>
                <TarjetaCiudad
                  nombre={m.nombre}
                  slug={m.slug}
                  href={`/rankings/${m.comunidad.slug}/${m.slug}`}
                  color={COLORES[i % COLORES.length]}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
