import { getTranslations } from "next-intl/server";
import { ICONO_CATEGORIA } from "@/lib/filtros";
import type { Categoria } from "@/lib/types";

// "otros" (parques, rutas, monumentos genéricos...) no se etiqueta a
// propósito — es un cajón de sastre demasiado amplio para aportar
// información real con un solo icono. A diferencia de "Categorias"
// (plural, para páginas de categoría y filtros — "Conciertos en Sevilla"),
// este badge describe UN solo evento, así que usa "CategoriasSingular"
// ("Concierto", no "Conciertos").
export default async function BadgeCategoria({ categoria }: { categoria: Categoria | null | undefined }) {
  if (!categoria || categoria === "otros") return null;
  const Icono = ICONO_CATEGORIA[categoria];
  const t = await getTranslations("CategoriasSingular");

  return (
    <span
      className="badge-pill"
      style={{ background: "var(--accent)", color: "var(--accent-foreground)", borderColor: "var(--accent)" }}
    >
      {Icono && <Icono size={11} strokeWidth={2.5} className="mr-1" />}
      {t(categoria)}
    </span>
  );
}
