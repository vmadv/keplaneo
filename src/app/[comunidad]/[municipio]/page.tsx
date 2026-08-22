import Link from "next/link";
import { notFound } from "next/navigation";
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
    <main className="max-w-3xl mx-auto px-6 py-16">
      <Breadcrumb
        items={[
          { label: "Inicio", href: "/" },
          { label: municipio.comunidad.nombre, href: `/${comunidadSlug}` },
          { label: municipio.nombre },
        ]}
      />
      <h1 className="text-3xl font-bold mt-4 mb-6">
        Qué hacer en {municipio.nombre}
      </h1>

      {municipio.lat !== null && municipio.lon !== null && (
        <Mapa lat={municipio.lat} lon={municipio.lon} etiqueta={municipio.nombre} direccionTexto={municipio.nombre} />
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Hoy</h2>
        <ul className="flex flex-wrap gap-4 text-sm">
          <li><Link href={`${base}/hoy`} className="hover:underline">General</Link></li>
          <li><Link href={`${base}/hoy/pareja`} className="hover:underline">En pareja</Link></li>
          <li><Link href={`${base}/hoy/familia`} className="hover:underline">En familia</Link></li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Este fin de semana</h2>
        <ul className="flex flex-wrap gap-4 text-sm">
          <li><Link href={`${base}/fin-de-semana`} className="hover:underline">General</Link></li>
          <li><Link href={`${base}/fin-de-semana/pareja`} className="hover:underline">En pareja</Link></li>
          <li><Link href={`${base}/fin-de-semana/familia`} className="hover:underline">En familia</Link></li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Por mes</h2>
        <ul className="flex flex-wrap gap-3 text-sm">
          {MESES.map((mes) => (
            <li key={mes}>
              <Link href={`${base}/${mes}`} className="hover:underline capitalize">
                {mes}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <NearbyMunicipios municipio={municipio} comunidadSlug={comunidadSlug} />
    </main>
  );
}
