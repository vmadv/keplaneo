import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Utensils, Bed, HeartPulse, GraduationCap, Sparkles, Music, Briefcase, Trophy, ArrowRight } from "lucide-react";
import { getListadosDelMunicipio } from "@/lib/queries";
import { agruparPorSeccion, slugDeSeccion, type SeccionListado } from "@/lib/categoriasListados";

const ICONO_SECCION: Record<SeccionListado, typeof Trophy> = {
  restaurantes: Utensils,
  alojamiento: Bed,
  salud: HeartPulse,
  educacion: GraduationCap,
  bellezaBienestar: Sparkles,
  ocio: Music,
  servicios: Briefcase,
  otros: Trophy,
};

// Sección "aparte" de planes: es solo un teaser hacia el vertical de
// rankings (/rankings/...), no forma parte de la navegación de
// vigencia/audiencia de MunicipioPageNav a propósito. Enlaza por SECCIÓN,
// no uno por uno — con 30 listados publicados, listarlos todos aquí es
// justo el "se me hace demasiado" que ya arreglamos en el índice de
// rankings; el detalle vive ahí, esto es solo la puerta de entrada.
export default async function ListadosDelMunicipio({
  municipioId,
  municipioNombre,
  comunidadSlug,
  municipioSlug,
}: {
  municipioId: string;
  municipioNombre: string;
  comunidadSlug: string;
  municipioSlug: string;
}) {
  const [listados, t, tSecciones] = await Promise.all([
    getListadosDelMunicipio(municipioId),
    getTranslations("Listados"),
    getTranslations("ListadosSecciones"),
  ]);
  if (listados.length === 0) return null;

  const base = `/rankings/${comunidadSlug}/${municipioSlug}`;
  const grupos = agruparPorSeccion(listados);

  return (
    <section className="mt-10 pt-8" style={{ borderTop: "2px dashed var(--border)" }}>
      <h2 className="text-lg font-extrabold mb-3">{t("seccionTitulo", { municipio: municipioNombre })}</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {grupos.map(({ seccion }) => {
          const Icono = ICONO_SECCION[seccion];
          return (
            <Link key={seccion} href={`${base}/seccion/${slugDeSeccion(seccion)}`} className="btn-secondary text-sm px-4 py-2">
              <Icono size={14} strokeWidth={2.5} />
              {tSecciones(seccion)}
            </Link>
          );
        })}
      </div>
      <Link href={base} className="btn-primary text-sm">
        {t("verTodos")}
        <ArrowRight size={14} strokeWidth={2.5} />
      </Link>
    </section>
  );
}
