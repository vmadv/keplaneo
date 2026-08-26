import { existsSync } from "node:fs";
import path from "node:path";

// Convención simple: si existe public/municipios/{slug}.{ext}, esa es la
// foto de portada del municipio. Sin ningún proceso automático detrás — se
// sube el archivo a mano y ya está. Si no existe, las páginas caen de
// vuelta a su cabecera de siempre (sin foto).
const EXTENSIONES_IMAGEN = ["jpg", "jpeg", "png", "webp"];

export function buscarImagenHero(slug: string): string | null {
  for (const ext of EXTENSIONES_IMAGEN) {
    const archivo = `${slug}.${ext}`;
    if (existsSync(path.join(process.cwd(), "public", "municipios", archivo))) {
      return `/municipios/${archivo}`;
    }
  }
  return null;
}
