import { Link } from "@/i18n/navigation";
import { MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getComunidades } from "@/lib/queries";

export const revalidate = 86400;

const COLORES = ["var(--secondary)", "var(--tertiary)", "var(--quaternary)"];

export default async function HomePage() {
  const [comunidades, tSitio, tHome] = await Promise.all([
    getComunidades(),
    getTranslations("Sitio"),
    getTranslations("Home"),
  ]);

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <div className="relative mb-12">
          <div
            className="absolute -top-8 -left-6 w-40 h-40 rounded-full -z-10"
            style={{ background: "var(--tertiary)", opacity: 0.5 }}
            aria-hidden="true"
          />
          <h1 className="text-5xl font-extrabold mb-3 text-balance">{tSitio("titulo")}</h1>
          <p className="text-lg" style={{ color: "var(--muted-foreground)" }}>
            {tSitio("descripcion")}
          </p>
        </div>

        {comunidades.length === 0 ? (
          <p style={{ color: "var(--muted-foreground)" }}>{tHome("sinComunidades")}</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-5">
            {comunidades.map((c, i) => (
              <li key={c.id}>
                <Link href={`/${c.slug}`} className="card-sticker flex items-center gap-3 p-5">
                  <span
                    className="icon-chip w-10 h-10 shrink-0"
                    style={{ background: COLORES[i % COLORES.length] }}
                  >
                    <MapPin size={18} strokeWidth={2.5} />
                  </span>
                  <span className="text-lg font-bold">{c.nombre}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
