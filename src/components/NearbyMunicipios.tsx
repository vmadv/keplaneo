import Link from "next/link";
import { getMunicipiosCercanos } from "@/lib/queries";
import type { Municipio } from "@/lib/types";

// Segundo eje de enlazado del blueprint: cada municipio enlaza a 3-5
// municipios cercanos de la misma comunidad, para repartir autoridad
// lateralmente y no depender solo del hub de comunidad.
export default async function NearbyMunicipios({
  municipio,
  comunidadSlug,
}: {
  municipio: Municipio;
  comunidadSlug: string;
}) {
  const cercanos = await getMunicipiosCercanos(municipio);
  if (cercanos.length === 0) return null;

  return (
    <section className="mt-10 border-t pt-6">
      <h2 className="text-lg font-semibold mb-3">Planes cerca de {municipio.nombre}</h2>
      <ul className="flex flex-wrap gap-3 text-sm">
        {cercanos.map((m) => (
          <li key={m.id}>
            <Link href={`/${comunidadSlug}/${m.slug}/hoy`} className="hover:underline">
              Qué hacer hoy en {m.nombre}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
