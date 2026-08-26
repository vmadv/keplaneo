import { redirect } from "@/i18n/navigation";
import { getComunidades } from "@/lib/queries";
import { notFound } from "next/navigation";

// "espana" es un segmento real y permanente en la URL (raíz obligatoria de
// toda la jerarquía geográfica de rankings — ver conversación) aunque hoy
// no tenga contenido propio: solo existe una comunidad (Andalucía), así que
// en vez de una página de índice casi vacía se pasa directo a ella. El día
// que haya más de una comunidad con rankings, esta página se convierte en
// el índice real de país.
export default async function EspanaRankingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const comunidades = await getComunidades();
  const primera = comunidades[0];
  if (!primera) notFound();
  redirect({ href: `/rankings/espana/${primera.slug}`, locale });
}
