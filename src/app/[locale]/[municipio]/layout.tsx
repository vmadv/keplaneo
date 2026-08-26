import { setRequestLocale } from "next-intl/server";
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
  params: Promise<{ locale: string; municipio: string }>;
}) {
  const { locale, municipio: municipioSlug } = await params;
  // Ver [locale]/layout.tsx: necesario en cada segmento para que las
  // páginas hijas con generateStaticParams puedan pintarse estáticas.
  setRequestLocale(locale);
  const municipio = await getMunicipio(municipioSlug);

  return (
    <>
      {children}
      {municipio && <NewsletterPopup municipioId={municipio.id} municipioNombre={municipio.nombre} />}
    </>
  );
}
