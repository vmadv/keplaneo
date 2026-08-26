import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import TarjetaCiudad from "@/components/TarjetaCiudad";
import { buscarImagenHero } from "@/lib/heroImage";
import { getMunicipiosConRankingsPorProvincia, getProvincia } from "@/lib/queries";

export const revalidate = 86400;

const COLORES = ["var(--secondary)", "var(--tertiary)", "var(--quaternary)"];

async function cargar(ccaaSlug: string, provinciaSlug: string) {
  const provincia = await getProvincia(ccaaSlug, provinciaSlug);
  if (!provincia) return null;
  const municipios = await getMunicipiosConRankingsPorProvincia(provincia.id);
  return { provincia, municipios };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ccaa: string; provincia: string }>;
}): Promise<Metadata> {
  const { ccaa, provincia: provinciaSlug } = await params;
  const datos = await cargar(ccaa, provinciaSlug);
  if (!datos) return {};
  const t = await getTranslations("ListadosProvincia");
  return { title: `${t("titulo", { provincia: datos.provincia.nombre })} | Planes España` };
}

// Único nivel de la jerarquía país/CCAA/provincia con contenido real hoy
// (aparte de municipio) — ver conversación: país y CCAA se dejan con el
// modelo de datos listo (esta misma consulta ya soporta varias comunidades
// y provincias) pero sin página de índice propia todavía.
export default async function ProvinciaRankingsPage({
  params,
}: {
  params: Promise<{ ccaa: string; provincia: string }>;
}) {
  const { ccaa: ccaaSlug, provincia: provinciaSlug } = await params;
  const datos = await cargar(ccaaSlug, provinciaSlug);
  if (!datos) notFound();
  const { provincia, municipios } = datos;

  const [tNav, t] = await Promise.all([getTranslations("Nav"), getTranslations("ListadosProvincia")]);

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: provincia.comunidad.nombre },
            { label: provincia.nombre },
          ]}
        />

        <h1 className="text-4xl font-extrabold mt-4 mb-3 text-balance">{t("titulo", { provincia: provincia.nombre })}</h1>
        <p className="mb-10 text-lg" style={{ color: "var(--muted-foreground)" }}>
          {t("subtitulo", { provincia: provincia.nombre })}
        </p>

        {municipios.length === 0 ? (
          <p style={{ color: "var(--muted-foreground)" }}>{t("sinCiudades")}</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-5">
            {municipios.map((m, i) => (
              <li key={m.id}>
                <TarjetaCiudad
                  nombre={m.nombre}
                  href={`/rankings/espana/${ccaaSlug}/${provinciaSlug}/${m.slug}`}
                  color={COLORES[i % COLORES.length]}
                  imagen={buscarImagenHero(m.slug)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
