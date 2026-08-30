import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { routing } from "@/i18n/routing";
import SiteHeader from "@/components/SiteHeader";
import { getComunidadBySlug, getMunicipiosByComunidad } from "@/lib/queries";
import { SITE_URL } from "@/lib/rutasLocale";
import { construirOrganizacionYSitioJsonLd } from "@/lib/structuredData";
import "../globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Sitio" });
  return {
    // Resuelve cualquier URL relativa/absoluta que se use en el resto de
    // metadata (OG images, etc.) contra el dominio real en vez de asumir
    // localhost — sin esto, una imagen con ruta relativa se resolvería mal
    // en producción.
    metadataBase: new URL(SITE_URL),
    title: t("titulo"),
    description: t("descripcion"),
    // Reutiliza automáticamente la misma imagen OG (opengraph-image.tsx)
    // que ya se detecta por convención de carpetas — Twitter/X no la
    // mostraba sin esto, aunque ya existiera para Facebook/WhatsApp.
    twitter: { card: "summary_large_image" },
  };
}

// Este es el layout raíz de verdad (no hay otro app/layout.tsx por encima):
// con next-intl, [locale] es el primer segmento de toda la app, así que
// aquí es donde va <html>/<body>.
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Necesario para que las rutas con generateStaticParams (hoy/[audiencia],
  // [categoriaOMes], etc.) puedan pintarse estáticas: sin esto,
  // getTranslations/getLocale más abajo en el árbol leen el locale de
  // forma dinámica y Next tira DYNAMIC_SERVER_USAGE en build de producción
  // (ver conversación — así estaba roto en Vercel).
  setRequestLocale(locale);

  // MVP centrado en Sevilla y su provincia (ver conversación): el selector
  // de municipio del header necesita la lista completa; se carga aquí en
  // servidor (comunidad fija por ahora) y se pasa al header, que es client
  // component.
  const comunidad = await getComunidadBySlug("andalucia");
  const municipios = comunidad ? await getMunicipiosByComunidad(comunidad.id) : [];
  const jsonLdOrganizacion = await construirOrganizacionYSitioJsonLd();

  return (
    <html lang={locale} className={`${outfit.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganizacion) }} />
        <NextIntlClientProvider>
          <SiteHeader municipios={municipios.map((m) => ({ slug: m.slug, nombre: m.nombre }))} />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
