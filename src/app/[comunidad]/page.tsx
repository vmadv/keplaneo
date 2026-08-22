import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
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

  const municipios = await getMunicipiosByComunidad(comunidad.id);

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb items={[{ label: "Inicio", href: "/" }, { label: comunidad.nombre }]} />
        <h1 className="text-4xl font-extrabold mt-4 mb-8 text-balance">
          Qué hacer en {comunidad.nombre}
        </h1>

        <ul className="grid sm:grid-cols-2 gap-5">
          {municipios.map((m, i) => (
            <li key={m.id}>
              <Link href={`/${comunidad.slug}/${m.slug}`} className="card-sticker flex items-center gap-3 p-5">
                <span
                  className="icon-chip w-10 h-10 shrink-0"
                  style={{ background: COLORES[i % COLORES.length] }}
                >
                  <MapPin size={18} strokeWidth={2.5} />
                </span>
                <span className="text-lg font-bold">{m.nombre}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
