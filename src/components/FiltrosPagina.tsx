import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import FiltroTemporal from "./FiltroTemporal";
import type { FiltroTemporalItem, FiltrosSecundariosAgrupados } from "@/lib/filtros";

// Hoy/Finde/Semana/Siempre y En pareja/Con niños/Gratis son dos ejes
// independientes que se pueden combinar (ej. "Hoy" + "En pareja" a la
// vez), no una única lista de opciones excluyentes entre sí — iban todos
// en una sola fila con el mismo estilo de pastilla y eso no se notaba
// (ver conversación). Se separan en dos filas con una etiqueta delante de
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
      <summary className="btn-secondary border-[1.5px] border-[var(--border)] font-semibold text-[var(--muted-foreground)] text-xs px-3 py-1.5 sm:text-sm sm:px-6 sm:py-[0.65rem] cursor-pointer">
        <SlidersHorizontal size={14} strokeWidth={2.5} />
        {t("masFiltros")}
        <ChevronDown size={14} strokeWidth={2.5} />
      </summary>
      <div className="basis-full flex flex-col gap-3 mt-4">
        {meses.length > 0 && <FiltroTemporal items={meses} className="mb-0" compacto />}
        {tematica.length > 0 && <FiltroTemporal items={tematica} className="mb-0" compacto />}
      </div>
    </details>
  );

  // Siempre con la etiqueta "CUÁNDO" delante, haya o no una segunda sección
  // — antes, en páginas sin "Filtra más" (los meses, sin cruce de
  // audiencia/gratis todavía), caía a una fila suelta sin etiquetar y con
  // "Más filtros" mezclado dentro, dando la sensación de una página con
  // otro estilo (ver conversación).
  if (rapidos.length === 0) {
    return (
      <div className="mb-6">
        <FiltroTemporal items={siempreVisibles} className="mb-0" etiqueta={tFiltros("cuando")} compacto extra={masFiltros} />
      </div>
    );
  }

  // La invitación a combinar apunta al eje que TODAVÍA no se ha usado: si
  // ya elegiste un "cuándo" pero no un "filtra más" (o al revés), es ahí
  // donde tiene sentido llamar la atención — si ya combinaste los dos, o si
  // no has tocado ninguno todavía, se queda en "Filtra más" por defecto
  // (ver conversación).
  const cuandoElegido = siempreVisibles.some((item) => item.activo) || meses.some((item) => item.activo);
  const filtraMasElegido = rapidos.some((item) => item.activo);
  const invitaFiltraMas = !filtraMasElegido;
  const invitaCuando = filtraMasElegido && !cuandoElegido;

  return (
    <div className="mb-6 grid gap-4">
      <div>
        <FiltroTemporal
          items={siempreVisibles}
          className="mb-0"
          etiqueta={tFiltros("cuando")}
          compacto
          invita={invitaCuando}
        />
      </div>
      <div>
        <FiltroTemporal
          items={rapidos}
          className="mb-0"
          etiqueta={tFiltros("filtraMas")}
          compacto
          invita={invitaFiltraMas}
          extra={masFiltros}
        />
      </div>
    </div>
  );
}
