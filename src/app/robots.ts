import type { MetadataRoute } from "next";

// Todavía en pruebas: bloquea toda indexación hasta que decidamos lanzar
// de verdad. Quitar este archivo (y el `robots: {index:false}` del layout
// raíz en `[locale]/layout.tsx`) para permitir que los buscadores entren.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
