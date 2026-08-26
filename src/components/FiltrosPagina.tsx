import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import FiltroTemporal from "./FiltroTemporal";
import type { FiltroTemporalItem, FiltrosSecundariosAgrupados } from "@/lib/filtros";

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>
      {children}
    </p>
  );
}

// Hoy/Finde/Semana y En pareja/En familia/Gratis son dos ejes
// independientes que se pueden combinar (ej. "Hoy" + "En pareja" a la
// vez), no una única lista de opciones excluyentes entre sí — iban todos
// en una sola fila con el mismo estilo de pastilla y eso no se notaba
// (ver conversación). Se separan en dos filas con una etiqueta encima de
// cada una para que se lea como "elige cuándo, y además a quién/precio".
// Los meses y la temática son los que más abultan, así que esos viven
// detrás de "Más filtros", al final de la segunda fila.
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
  const [t, tFiltros] = await Promise.all([getTranslations("Nav"), getTranslations("Filtros")]);
  const siempreVisibles = primarios.slice(0, 3);
  const meses = primarios.slice(3);
  const rapidos = secundarios ? [...secundarios.audiencia, ...secundarios.precio] : [];
  const tematica = secundarios?.tematica ?? [];
  const ocultos = [...meses, ...tematica];
  const hayActivoOculto = ocultos.some((item) => item.activo);

  const masFiltros = ocultos.length > 0 && (
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
  );

  if (rapidos.length === 0) {
    return (
      <div className="mb-2">
        <FiltroTemporal items={siempreVisibles} className="mb-6" extra={masFiltros} />
      </div>
    );
  }

  return (
    <div className="mb-6 grid gap-4">
      <div>
        <Etiqueta>{tFiltros("cuando")}</Etiqueta>
        <FiltroTemporal items={siempreVisibles} className="mb-0" />
      </div>
      <div>
        <Etiqueta>{tFiltros("filtraMas")}</Etiqueta>
        <FiltroTemporal items={rapidos} className="mb-0" extra={masFiltros} />
      </div>
    </div>
  );
}
