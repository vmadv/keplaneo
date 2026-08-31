import { getTranslations } from "next-intl/server";
import FiltroTemporal from "./FiltroTemporal";
import { MasFiltrosProvider, MasFiltrosBoton, MasFiltrosPanel } from "./MasFiltrosDisclosure";
import type { FiltroTemporalItem, FiltrosSecundariosAgrupados } from "@/lib/filtros";

// Hoy/Finde/Semana/Siempre y En pareja/Con niños/Gratis son dos ejes
// independientes que se pueden combinar (ej. "Hoy" + "En pareja" a la
// vez) — se separan en dos filas por agrupación visual (el salto de línea
// ya lo comunica), sin etiquetas "CUÁNDO"/"FILTRA MÁS" delante: sencillo
// de entender de un vistazo sin que haga falta explicarlo (ver
// conversación). Los meses y la temática son los que más abultan, así que
// esos viven detrás de "Más filtros", al final de la segunda fila.
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
  const t = await getTranslations("Nav");
  const siempreVisibles = primarios.slice(0, 4);
  const meses = primarios.slice(4);
  const rapidos = secundarios ? [...secundarios.audiencia, ...secundarios.precio] : [];
  const tematica = secundarios?.tematica ?? [];
  const ocultos = [...meses, ...tematica];
  const hayActivoOculto = ocultos.some((item) => item.activo);

  const hayMasFiltros = ocultos.length > 0;
  const boton = hayMasFiltros && <MasFiltrosBoton label={t("masFiltros")} />;
  // Meses y temática juntos en una sola fila que envuelve (en vez de dos
  // filas separadas, una por grupo) — así ocupan las menos líneas posibles
  // en vez de forzar un salto de línea aunque sobre hueco (ver conversación).
  const panel = hayMasFiltros && (
    <MasFiltrosPanel>
      <FiltroTemporal items={ocultos} className="mb-0" compacto />
    </MasFiltrosPanel>
  );

  if (rapidos.length === 0) {
    return (
      <MasFiltrosProvider initialOpen={hayActivoOculto}>
        <div className="mb-6 grid gap-1">
          <FiltroTemporal items={siempreVisibles} className="mb-0" compacto scrollable extra={boton} />
          {panel}
        </div>
      </MasFiltrosProvider>
    );
  }

  // El icono suelto de "aquí también puedes filtrar" apunta al eje que
  // TODAVÍA no se ha tocado: si ya elegiste un "cuándo" pero no un "filtra
  // más" (o al revés), es ahí donde tiene sentido llamar la atención — si
  // ya combinaste los dos, o si no has tocado ninguno todavía, no invita a
  // ningún lado en concreto (ver conversación).
  const cuandoElegido = siempreVisibles.some((item) => item.activo) || meses.some((item) => item.activo);
  const filtraMasElegido = rapidos.some((item) => item.activo);
  const invitaFiltraMas = cuandoElegido && !filtraMasElegido;
  const invitaCuando = filtraMasElegido && !cuandoElegido;

  return (
    <MasFiltrosProvider initialOpen={hayActivoOculto}>
      <div className="mb-6 grid gap-1">
        <FiltroTemporal items={siempreVisibles} className="mb-0" compacto scrollable invita={invitaCuando} />
        <FiltroTemporal
          items={rapidos}
          className="mb-0"
          compacto
          scrollable
          invita={invitaFiltraMas}
          invitaReaccionaASiempre
          extra={boton}
        />
        {panel}
      </div>
    </MasFiltrosProvider>
  );
}
