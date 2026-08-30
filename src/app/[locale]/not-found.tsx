import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Un 404 nunca debe indexarse, ni siquiera cuando se quite el noindex
// general del resto del sitio (ver [locale]/layout.tsx) — es contenido
// que no existe, no una página real a posicionar.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main className="flex-1 bg-dots flex items-center">
      <div className="max-w-md mx-auto px-6 py-24 text-center">
        <div className="icon-chip w-16 h-16 mx-auto mb-6" style={{ background: "var(--tertiary)" }}>
          <Compass size={28} strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-extrabold mb-3 text-balance">{t("titulo")}</h1>
        <p className="mb-8" style={{ color: "var(--muted-foreground)" }}>
          {t("mensaje")}
        </p>
        <Link href="/" className="btn-primary">
          {t("volver")}
        </Link>
      </div>
    </main>
  );
}
