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
    <main className="max-w-3xl mx-auto px-6 py-16">
      <Breadcrumb
        items={[
          { label: "Inicio", href: "/" },
          { label: municipio.comunidad.nombre, href: `/${comunidadSlug}` },
          { label: municipio.nombre, href: base },
          { label: mes.charAt(0).toUpperCase() + mes.slice(1) },
        ]}
      />
      <h1 className="text-3xl font-bold mt-4 mb-8 capitalize">
        Qué hacer en {municipio.nombre} en {mes}
      </h1>

      <PlanList planes={planes} base={base} />

      <nav className="mt-10 border-t pt-6">
        <h2 className="text-lg font-semibold mb-3">También te puede interesar</h2>
        <ul className="flex flex-wrap gap-4 text-sm">
          <li><Link href={`${base}/hoy`} className="hover:underline">Qué hacer hoy</Link></li>
          <li><Link href={`${base}/fin-de-semana`} className="hover:underline">Qué hacer este fin de semana</Link></li>
          <li><Link href={base} className="hover:underline">Ver todos los planes de {municipio.nombre}</Link></li>
        </ul>
      </nav>
    </main>
  );
}
