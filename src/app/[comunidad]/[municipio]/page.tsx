import Link from "next/link";
import { notFound } from "next/navigation";
import { Sun, CalendarDays, CalendarRange } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import NearbyMunicipios from "@/components/NearbyMunicipios";
import Mapa from "@/components/Mapa";
import { getMunicipio } from "@/lib/queries";
import { MESES } from "@/lib/types";

export const revalidate = 86400;

export default async function MunicipioPage({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string }>;
}) {
  const { comunidad: comunidadSlug, municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(comunidadSlug, municipioSlug);
  if (!municipio) notFound();

  const base = `/${comunidadSlug}/${municipioSlug}`;

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: "Inicio", href: "/" },
            { label: municipio.comunidad.nombre, href: `/${comunidadSlug}` },
            { label: municipio.nombre },
          ]}
        />
        <h1 className="text-4xl font-extrabold mt-4 mb-6 text-balance">
          Qué hacer en {municipio.nombre}
        </h1>

        {municipio.lat !== null && municipio.lon !== null && (
          <div className="card-sticker p-2 mb-8">
            <Mapa lat={municipio.lat} lon={municipio.lon} etiqueta={municipio.nombre} direccionTexto={municipio.nombre} />
          </div>
        )}

        <section className="mb-8">
          <h2 className="flex items-center gap-2 text-lg font-extrabold mb-3">
            <span className="icon-chip w-8 h-8" style={{ background: "var(--tertiary)" }}>
              <Sun size={16} strokeWidth={2.5} />
            </span>
            Hoy
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link href={`${base}/hoy`} className="btn-secondary">General</Link>
            <Link href={`${base}/hoy/pareja`} className="btn-secondary">En pareja</Link>
            <Link href={`${base}/hoy/familia`} className="btn-secondary">En familia</Link>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="flex items-center gap-2 text-lg font-extrabold mb-3">
            <span className="icon-chip w-8 h-8" style={{ background: "var(--secondary)" }}>
              <CalendarDays size={16} strokeWidth={2.5} />
            </span>
            Este fin de semana
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link href={`${base}/fin-de-semana`} className="btn-secondary">General</Link>
            <Link href={`${base}/fin-de-semana/pareja`} className="btn-secondary">En pareja</Link>
            <Link href={`${base}/fin-de-semana/familia`} className="btn-secondary">En familia</Link>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="flex items-center gap-2 text-lg font-extrabold mb-3">
            <span className="icon-chip w-8 h-8" style={{ background: "var(--quaternary)" }}>
              <CalendarRange size={16} strokeWidth={2.5} />
            </span>
            Por mes
          </h2>
          <div className="flex flex-wrap gap-2">
            {MESES.map((mes) => (
              <Link key={mes} href={`${base}/${mes}`} className="btn-secondary capitalize">
                {mes}
              </Link>
            ))}
          </div>
        </section>

        <NearbyMunicipios municipio={municipio} comunidadSlug={comunidadSlug} />
      </div>
    </main>
  );
}
