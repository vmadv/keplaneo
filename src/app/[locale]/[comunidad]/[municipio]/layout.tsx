import NewsletterPopup from "@/components/NewsletterPopup";
import { getMunicipio } from "@/lib/queries";

// Envuelve TODAS las páginas de un municipio (hub, hoy, finde, esta
// semana, categorías, ficha de evento...) sin tocar cada page.tsx —
// Next.js anida los layouts automáticamente. Si el municipio no existe la
// propia página hará notFound(); aquí simplemente no se muestra el popup.
export default async function MunicipioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ comunidad: string; municipio: string }>;
}) {
  const { comunidad: comunidadSlug, municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(comunidadSlug, municipioSlug);

  return (
    <>
      {children}
      {municipio && <NewsletterPopup municipioId={municipio.id} municipioNombre={municipio.nombre} />}
    </>
  );
}
