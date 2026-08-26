import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import FiltroTemporal from "./FiltroTemporal";
import type { FiltroTemporalItem, FiltrosSecundariosAgrupados } from "@/lib/filtros";

// Hoy / Este fin de semana / Esta semana / En pareja / En familia / Gratis
// van todos en una sola fila — son pocas pastillas y de uso frecuente. Los
// meses y la temática son los que más abultan, así que esos viven detrás
// de "Más filtros", al final de esa misma fila.
// construirFiltrosTemporales siempre devuelve [Hoy, Finde, Esta semana,
// ...meses] en ese orden, así que los meses son el resto del array desde
// la posición 3.
// Si el mes activo está escondido (ej. viendo /agosto), el panel se abre
// solo para no perder de vista qué está seleccionado.
export default async function FiltrosPagina({
  primarios,
  secundarios,
}: {
  primarios: FiltroTemporalItem[];
  secundarios?: FiltrosSecundariosAgrupados;
}) {
  const t = await getTranslations("Nav");
  const siempreVisibles = primarios.slice(0, 3);
  const meses = primarios.slice(3);
  const rapidos = secundarios ? [...secundarios.audiencia, ...secundarios.precio] : [];
  const tematica = secundarios?.tematica ?? [];
  const ocultos = [...meses, ...tematica];
  const hayActivoOculto = ocultos.some((item) => item.activo);

  return (
    <div className="mb-2">
      <FiltroTemporal
        items={[...siempreVisibles, ...rapidos]}
        className="mb-6"
        extra={
          ocultos.length > 0 && (
            <details className="filtro-disclosure" open={hayActivoOculto}>
              <summary className="btn-secondary text-sm cursor-pointer">
                <SlidersHorizontal size={14} strokeWidth={2.5} />
                {t("masFiltros")}
                <ChevronDown size={14} strokeWidth={2.5} />
              </summary>
              <div className="basis-full flex flex-col gap-3 mt-4">
                {meses.length > 0 && <FiltroTemporal items={meses} className="mb-0" />}
                {tematica.length > 0 && <FiltroTemporal items={tematica} className="mb-0" />}
              </div>
            </details>
          )
        }
      />
    </div>
  );
}
