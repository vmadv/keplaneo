import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import PlanList from "@/components/PlanList";
import MunicipioPageNav from "@/components/MunicipioPageNav";
import { getMunicipio, getPlanesGratisHoy } from "@/lib/queries";
import { fechaDeHoyLegible } from "@/lib/dates";

export const revalidate = 86400;

// Página de ejemplo: una dimensión de filtro nueva (precio) además de
// audiencia y vigencia. Si funciona bien, se puede formalizar como parte
// fija de la taxonomía (enlazarla desde el hub de municipio, replicarla en
// fin de semana/mes...); de momento es solo para valorarla.
export default async function GratisPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [planes, tNav, tGratis, locale] = await Promise.all([
    getPlanesGratisHoy(municipio.id),
    getTranslations("Nav"),
    getTranslations("Gratis"),
    getLocale(),
  ]);
  const base = `/${municipioSlug}`;

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre },
            { label: municipio.nombre, href: base },
            { label: tGratis("breadcrumb") },
          ]}
        />
        <h1 className="text-4xl font-extrabold mt-4 mb-8 text-balance">
          {tGratis("titulo", { municipio: municipio.nombre, fecha: fechaDeHoyLegible(locale) })}
        </h1>

        <PlanList planes={planes} base={base} contexto="hoy" />

        <MunicipioPageNav municipioSlug={municipioSlug} municipioNombre={municipio.nombre} />
      </div>
    </main>
  );
}
