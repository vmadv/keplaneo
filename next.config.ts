import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Los segmentos de vigencia/audiencia/precio son carpetas literales (no
// [dinámicas]), así que next-intl no puede traducirlas (su `pathnames`
// solo traduce hrefs con forma de objeto {pathname, params}, y este sitio
// usa 100% strings — adoptarlo obligaría a reescribir todo enlace del
// sitio para que compile, ver conversación). Se resuelve aquí, con
// rewrites planos: la URL que ve el visitante en inglés usa la palabra
// inglesa, pero por dentro sigue sirviendo la misma carpeta en español de
// siempre. El orden importa: las reglas con "/free" anidado van antes que
// las de audiencia para no perder esa segunda parte de la ruta.
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/en/:municipio/today", destination: "/en/:municipio/hoy" },
      { source: "/en/:municipio/this-weekend", destination: "/en/:municipio/fin-de-semana" },
      { source: "/en/:municipio/this-week", destination: "/en/:municipio/esta-semana" },
      { source: "/en/:municipio/free", destination: "/en/:municipio/gratis" },
      { source: "/en/:municipio/with-kids", destination: "/en/:municipio/con-ninos" },
      { source: "/en/:municipio/for-couples", destination: "/en/:municipio/en-pareja" },

      { source: "/en/:municipio/today/free", destination: "/en/:municipio/hoy/gratis" },
      { source: "/en/:municipio/this-weekend/free", destination: "/en/:municipio/fin-de-semana/gratis" },
      { source: "/en/:municipio/this-week/free", destination: "/en/:municipio/esta-semana/gratis" },

      { source: "/en/:municipio/today/couple", destination: "/en/:municipio/hoy/pareja" },
      { source: "/en/:municipio/today/with-kids", destination: "/en/:municipio/hoy/con-ninos" },
      { source: "/en/:municipio/this-weekend/couple", destination: "/en/:municipio/fin-de-semana/pareja" },
      { source: "/en/:municipio/this-weekend/with-kids", destination: "/en/:municipio/fin-de-semana/con-ninos" },
      { source: "/en/:municipio/this-week/couple", destination: "/en/:municipio/esta-semana/pareja" },
      { source: "/en/:municipio/this-week/with-kids", destination: "/en/:municipio/esta-semana/con-ninos" },

      { source: "/en/:municipio/:categoriaOMes/today", destination: "/en/:municipio/:categoriaOMes/hoy" },
      {
        source: "/en/:municipio/:categoriaOMes/this-weekend",
        destination: "/en/:municipio/:categoriaOMes/fin-de-semana",
      },
      {
        source: "/en/:municipio/:categoriaOMes/this-week",
        destination: "/en/:municipio/:categoriaOMes/esta-semana",
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
