import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import FiltroTemporal from "./FiltroTemporal";
import type { FiltroTemporalItem, FiltrosSecundariosAgrupados } from "@/lib/filtros";

function Etiqueta({ children, invita = false }: { children: React.ReactNode; invita?: boolean }) {
  return (
    <p
      className="text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1"
      style={{ color: "var(--muted-foreground)" }}
    >
      {children}
      {/* Un par de rebotes cortos al cargar la página, para invitar a
          combinarlo con lo que se acaba de elegir en Cuándo — ver
          conversación ("que me invite a clicar sobre filtra más"). */}
      {invita && <ChevronDown size={13} strokeWidth={3} className="icono-invitacion" aria-hidden />}
    </p>
  );
}

// Hoy/Finde/Semana/Siempre y En pareja/En familia/Gratis son dos ejes
// independientes que se pueden combinar (ej. "Hoy" + "En pareja" a la
// vez), no una única lista de opciones excluyentes entre sí — iban todos
// en una sola fila con el mismo estilo de pastilla y eso no se notaba
// (ver conversación). Se separan en dos filas con una etiqueta encima de
// cada una para que se lea como "elige cuándo, y además a quién/precio".
// Los meses y la temática son los que más abultan, así que esos viven
// detrás de "Más filtros", al final de la segunda fila.
// construirFiltrosTemporales siempre devuelve [Hoy, Finde, Esta semana,
// Siempre, ...meses] en ese orden, así que los meses son el resto del array
// desde la posición 4.
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
  const siempreVisibles = primarios.slice(0, 4);
  const meses = primarios.slice(4);
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

  // Siempre con la etiqueta "CUÁNDO" encima, haya o no una segunda sección
  // — antes, en páginas sin "Filtra más" (los meses, sin cruce de
  // audiencia/gratis todavía), caía a una fila suelta sin etiquetar y con
  // "Más filtros" mezclado dentro, dando la sensación de una página con
  // otro estilo (ver conversación).
  if (rapidos.length === 0) {
    return (
      <div className="mb-6">
        <Etiqueta>{tFiltros("cuando")}</Etiqueta>
        <FiltroTemporal items={siempreVisibles} className="mb-0" extra={masFiltros} />
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
        <Etiqueta invita>{tFiltros("filtraMas")}</Etiqueta>
        <FiltroTemporal items={rapidos} className="mb-0" extra={masFiltros} />
      </div>
    </div>
  );
}
