// Convierte "**texto**" (markdown) en <strong> — sin librería de markdown
// completa, es el único formato que pedimos a Gemini que use dentro de las
// descripciones.
export default function TextoConNegritas({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {partes.map((parte, i) => {
        const negrita = parte.match(/^\*\*([^*]+)\*\*$/);
        return negrita ? <strong key={i}>{negrita[1]}</strong> : <span key={i}>{parte}</span>;
      })}
    </>
  );
}
