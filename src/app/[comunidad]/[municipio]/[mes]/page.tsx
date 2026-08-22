import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import PlanList from "@/components/PlanList";
import { esMesSlugValido } from "@/lib/dates";
import { getMunicipio, getPlanesDelMes } from "@/lib/queries";
import { MESES } from "@/lib/types";

export const revalidate = 86400;

export function generateStaticParams() {
  return MESES.map((mes) => ({ mes }));
}

export default async function MesPage({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string; mes: string }>;
}) {
  const { comunidad: comunidadSlug, municipio: municipioSlug, mes } = await params;
  if (!esMesSlugValido(mes)) notFound();

  const municipio = await getMunicipio(comunidadSlug, municipioSlug);
  if (!municipio) notFound();

  const planes = await getPlanesDelMes(municipio.id, mes);
  const base = `/${comunidadSlug}/${municipioSlug}`;

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: "Inicio", href: "/" },
            { label: municipio.comunidad.nombre, href: `/${comunidadSlug}` },
            { label: municipio.nombre, href: base },
            { label: mes.charAt(0).toUpperCase() + mes.slice(1) },
          ]}
        />
        <h1 className="text-4xl font-extrabold mt-4 mb-8 capitalize text-balance">
          Qué hacer en {municipio.nombre} en {mes}
        </h1>

        <PlanList planes={planes} base={base} />

        <nav className="mt-10 pt-8" style={{ borderTop: "2px dashed var(--border)" }}>
          <h2 className="text-lg font-extrabold mb-3">También te puede interesar</h2>
          <div className="flex flex-wrap gap-3">
            <Link href={`${base}/hoy`} className="btn-secondary">Qué hacer hoy</Link>
            <Link href={`${base}/fin-de-semana`} className="btn-secondary">Qué hacer este fin de semana</Link>
            <Link href={base} className="btn-primary">Ver todos los planes de {municipio.nombre}</Link>
          </div>
        </nav>
      </div>
    </main>
  );
}
