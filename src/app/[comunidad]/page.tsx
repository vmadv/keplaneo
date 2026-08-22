import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { getComunidadBySlug, getMunicipiosByComunidad } from "@/lib/queries";

export const revalidate = 86400;

export default async function ComunidadPage({
  params,
}: {
  params: Promise<{ comunidad: string }>;
}) {
  const { comunidad: comunidadSlug } = await params;
  const comunidad = await getComunidadBySlug(comunidadSlug);
  if (!comunidad) notFound();

  const municipios = await getMunicipiosByComunidad(comunidad.id);

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <Breadcrumb
        items={[{ label: "Inicio", href: "/" }, { label: comunidad.nombre }]}
      />
      <h1 className="text-3xl font-bold mt-4 mb-8">
        Qué hacer en {comunidad.nombre}
      </h1>

      <ul className="grid gap-2">
        {municipios.map((m) => (
          <li key={m.id}>
            <Link href={`/${comunidad.slug}/${m.slug}`} className="text-lg hover:underline">
              {m.nombre}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
