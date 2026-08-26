import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { getComunidadBySlug, getProvincias } from "@/lib/queries";

// Mismo criterio que rankings/espana/page.tsx: la CCAA es un segmento real
// de la jerarquía pero, con una sola provincia real por comunidad hoy, no
// merece una página de índice propia todavía — se pasa directo a ella.
export default async function CcaaRankingsPage({
  params,
}: {
  params: Promise<{ locale: string; ccaa: string }>;
}) {
  const { locale, ccaa } = await params;
  const comunidad = await getComunidadBySlug(ccaa);
  if (!comunidad) notFound();

  const provincias = await getProvincias(comunidad.id);
  const primera = provincias[0];
  if (!primera) notFound();

  redirect({ href: `/rankings/espana/${ccaa}/${primera.slug}`, locale });
}
