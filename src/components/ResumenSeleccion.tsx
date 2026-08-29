import { construirIntroNarrativa, construirTituloLista, type ItemResumible } from "@/lib/resumenSeleccion";
import type { Vigencia, Extra } from "@/lib/filtros";
import type { PreguntaFrecuente } from "@/lib/types";

// Párrafo bajo el título — un resumen con algo de gancho (no un recuento
// seco) de lo que hay realmente en ESTA selección concreta: abre según
// cuándo/para quién, y cada categoría destacada lleva su propio matiz
// ("solo estos días" para lo puntual, distinto para lo evergreen — ver
// construirIntroNarrativa). Nada inventado, solo mejor contado: al depender
// de los datos de cada carga, cada combinación de municipio/cuándo/filtro
// sale distinta de forma natural (ver conversación sobre contenido fino a
// escala).
export async function IntroSeleccion({
  items,
  municipio,
  vigencia,
  extra,
}: {
  items: ItemResumible[];
  municipio: string;
  vigencia: Vigencia;
  extra?: Extra;
}) {
  const texto = await construirIntroNarrativa(items, municipio, vigencia, extra);
  if (!texto) return null;

  return (
    <p className="text-base mb-6 text-balance" style={{ color: "var(--muted-foreground)" }}>
      {texto}
    </p>
  );
}

// H2 antes de la lista de planes — ver construirTituloLista.
export async function TituloLista({
  municipio,
  vigencia,
  extra,
}: {
  municipio: string;
  vigencia: Vigencia;
  extra?: Extra;
}) {
  const titulo = await construirTituloLista(municipio, vigencia, extra);
  return <h2 className="text-lg font-extrabold mb-3">{titulo}</h2>;
}

// Bloque FAQ visible — recibe las preguntas ya calculadas (ver
// construirFaqSeleccion) en vez de recalcularlas, porque la página también
// necesita ese mismo array para el JSON-LD de FAQPage (mismo texto en los
// dos sitios, como exige Google: lo que declaras en datos estructurados
// tiene que coincidir con lo que se ve en la página).
export function FaqSeleccion({ preguntas }: { preguntas: PreguntaFrecuente[] }) {
  if (preguntas.length === 0) return null;
  return (
    <section className="mt-8 pt-6" style={{ borderTop: "2px dashed var(--border)" }}>
      <div className="grid gap-3">
        {preguntas.map((pf) => (
          <div key={pf.pregunta} className="card-sticker p-4">
            <p className="font-bold">{pf.pregunta}</p>
            <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
              {pf.respuesta}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
