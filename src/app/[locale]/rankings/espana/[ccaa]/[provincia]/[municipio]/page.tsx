import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Utensils, Bed, HeartPulse, GraduationCap, Sparkles, Music, Briefcase, Trophy, ChevronRight } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import MunicipioPageNav from "@/components/MunicipioPageNav";
import { getListadosDelMunicipio, getMunicipioConProvincia } from "@/lib/queries";
import { agruparPorSeccion, slugDeSeccion, type SeccionListado } from "@/lib/categoriasListados";

export const revalidate = 86400;

const ICONO_SECCION: Record<SeccionListado, typeof Trophy> = {
  restaurantes: Utensils,
  alojamiento: Bed,
  salud: HeartPulse,
  educacion: GraduationCap,
  bellezaBienestar: Sparkles,
  ocio: Music,
  servicios: Briefcase,
  otros: Trophy,
};

async function cargar(ccaaSlug: string, provinciaSlug: string, municipioSlug: string) {
  const municipio = await getMunicipioConProvincia(municipioSlug);
  if (!municipio) return null;
  if (municipio.comunidad.slug !== ccaaSlug || municipio.provinciaGeo?.slug !== provinciaSlug) return null;
  return municipio;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ccaa: string; provincia: string; municipio: string }>;
}): Promise<Metadata> {
  const { ccaa, provincia, municipio: municipioSlug } = await params;
  const municipio = await cargar(ccaa, provincia, municipioSlug);
  if (!municipio) return {};
  const t = await getTranslations("Listados");
  return { title: `${t("seccionTitulo", { municipio: municipio.nombre })} | Planes España` };
}

export default async function RankingsIndexPage({
  params,
}: {
  params: Promise<{ ccaa: string; provincia: string; municipio: string }>;
}) {
  const { ccaa: ccaaSlug, provincia: provinciaSlug, municipio: municipioSlug } = await params;
  const municipio = await cargar(ccaaSlug, provinciaSlug, municipioSlug);
  if (!municipio) notFound();

  const [listados, tNav, t, tSecciones] = await Promise.all([
    getListadosDelMunicipio(municipio.id),
    getTranslations("Nav"),
    getTranslations("Listados"),
    getTranslations("ListadosSecciones"),
  ]);
  const base = `/rankings/espana/${ccaaSlug}/${provinciaSlug}/${municipioSlug}`;
  const grupos = agruparPorSeccion(listados);

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre },
            {
              label: municipio.provinciaGeo?.nombre ?? municipio.comunidad.nombre,
              href: `/rankings/espana/${ccaaSlug}/${provinciaSlug}`,
            },
            { label: municipio.nombre },
          ]}
        />

        <h1 className="text-4xl font-extrabold mt-4 mb-8 text-balance">
          {t("seccionTitulo", { municipio: municipio.nombre })}
        </h1>

        {listados.length === 0 ? (
          <p style={{ color: "var(--muted-foreground)" }}>{t("sinListados", { municipio: municipio.nombre })}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {grupos.map(({ seccion, items }) => {
              const Icono = ICONO_SECCION[seccion];
              return (
                <Link
                  key={seccion}
                  href={`${base}/seccion/${slugDeSeccion(seccion)}`}
                  className="card-sticker flex items-center gap-3 p-4"
                >
                  <span className="icon-chip w-10 h-10 shrink-0" style={{ background: "var(--tertiary)" }}>
                    <Icono size={20} strokeWidth={2.5} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold">{tSecciones(seccion)}</span>
                    <span className="block text-sm" style={{ color: "var(--muted-foreground)" }}>
                      {t("numeroRankings", { n: items.length })}
                    </span>
                  </span>
                  <ChevronRight size={18} strokeWidth={2.5} style={{ color: "var(--muted-foreground)" }} />
                </Link>
              );
            })}
          </div>
        )}

        <MunicipioPageNav municipioSlug={municipioSlug} municipioNombre={municipio.nombre} />
      </div>
    </main>
  );
}
