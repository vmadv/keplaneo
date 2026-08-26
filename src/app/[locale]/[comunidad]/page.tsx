import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import TarjetaCiudad from "@/components/TarjetaCiudad";
import { getComunidadBySlug, getMunicipiosByComunidad } from "@/lib/queries";

export const revalidate = 86400;

const COLORES = ["var(--secondary)", "var(--tertiary)", "var(--quaternary)"];

export default async function ComunidadPage({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad: comunidadSlug } = await params;
  const comunidad = await getComunidadBySlug(comunidadSlug);
  if (!comunidad) notFound();

  const [municipios, tNav, tComunidad] = await Promise.all([
    getMunicipiosByComunidad(comunidad.id),
    getTranslations("Nav"),
    getTranslations("ComunidadHome"),
  ]);

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb items={[{ label: tNav("inicio"), href: "/" }, { label: comunidad.nombre }]} />
        <h1 className="text-4xl font-extrabold mt-4 mb-8 text-balance">
          {tComunidad("titulo", { comunidad: comunidad.nombre })}
        </h1>

        <ul className="grid sm:grid-cols-2 gap-5">
          {municipios.map((m, i) => (
            <li key={m.id}>
              <TarjetaCiudad
                nombre={m.nombre}
                slug={m.slug}
                href={`/${comunidad.slug}/${m.slug}`}
                color={COLORES[i % COLORES.length]}
              />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
