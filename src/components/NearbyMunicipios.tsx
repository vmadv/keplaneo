import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { getMunicipiosCercanos } from "@/lib/queries";
import type { Municipio } from "@/lib/types";

// Segundo eje de enlazado del blueprint: cada municipio enlaza a 3-5
// municipios cercanos de la misma comunidad, para repartir autoridad
// lateralmente y no depender solo del hub de comunidad.
export default async function NearbyMunicipios({ municipio }: { municipio: Municipio }) {
  const [cercanos, t] = await Promise.all([getMunicipiosCercanos(municipio), getTranslations("NearbyMunicipios")]);
  if (cercanos.length === 0) return null;

  return (
    <section className="mt-10 pt-8" style={{ borderTop: "2px dashed var(--border)" }}>
      <h2 className="text-lg font-extrabold mb-3">{t("titulo", { municipio: municipio.nombre })}</h2>
      <div className="flex flex-wrap gap-3">
        {cercanos.map((m) => (
          <Link key={m.id} href={`/${m.slug}/hoy`} className="btn-secondary">
            {t("queHacerHoyEn", { municipio: m.nombre })}
          </Link>
        ))}
      </div>
    </section>
  );
}
