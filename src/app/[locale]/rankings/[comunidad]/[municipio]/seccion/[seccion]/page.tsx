import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Trophy } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import MunicipioPageNav from "@/components/MunicipioPageNav";
import { getListadosDelMunicipio, getMunicipio } from "@/lib/queries";
import { seccionDeTipoLugar, seccionDesdeSlug } from "@/lib/categoriasListados";

export const revalidate = 86400;

async function cargar(comunidadSlug: string, municipioSlug: string, seccionSlug: string) {
  const seccion = seccionDesdeSlug(seccionSlug);
  if (!seccion) return null;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) return null;
  const todos = await getListadosDelMunicipio(municipio.id);
  const listados = todos.filter((l) => seccionDeTipoLugar(l.tipo_lugar) === seccion);
  if (listados.length === 0) return null;
  return { municipio, seccion, listados };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string; seccion: string }>;
}): Promise<Metadata> {
  const { comunidad, municipio: municipioSlug, seccion: seccionSlug } = await params;
  const datos = await cargar(comunidad, municipioSlug, seccionSlug);
  if (!datos) return {};
  const tSecciones = await getTranslations("ListadosSecciones");
  const t = await getTranslations("Listados");
  return {
    title: `${t("tituloSeccion", { seccion: tSecciones(datos.seccion), municipio: datos.municipio.nombre })} | Planes España`,
  };
}

export default async function SeccionRankingsPage({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string; seccion: string }>;
}) {
  const { comunidad: comunidadSlug, municipio: municipioSlug, seccion: seccionSlug } = await params;
  const datos = await cargar(comunidadSlug, municipioSlug, seccionSlug);
  if (!datos) notFound();
  const { municipio, seccion, listados } = datos;

  const [tNav, t, tSecciones] = await Promise.all([
    getTranslations("Nav"),
    getTranslations("Listados"),
    getTranslations("ListadosSecciones"),
  ]);
  const base = `/rankings/${comunidadSlug}/${municipioSlug}`;

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre },
            { label: municipio.nombre, href: base },
            { label: tSecciones(seccion) },
          ]}
        />

        <h1 className="text-4xl font-extrabold mt-4 mb-8 text-balance">
          {t("tituloSeccion", { seccion: tSecciones(seccion), municipio: municipio.nombre })}
        </h1>

        <div className="grid gap-4 sm:grid-cols-2">
          {listados.map((l) => (
            <Link key={l.id} href={`${base}/${l.slug}`} className="card-sticker flex items-center gap-3 p-4">
              <span className="icon-chip w-9 h-9 shrink-0" style={{ background: "var(--tertiary)" }}>
                <Trophy size={18} strokeWidth={2.5} />
              </span>
              <span className="font-bold">{l.titulo}</span>
            </Link>
          ))}
        </div>

        <MunicipioPageNav municipioSlug={municipioSlug} municipioNombre={municipio.nombre} />
      </div>
    </main>
  );
}
