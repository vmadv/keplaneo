import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  // España es el mercado principal (y el único real por ahora): sirve el
  // español directo en la raíz (keplaneo.com) sin redirección ni prefijo,
  // y solo añade /en para el idioma secundario. La detección de idioma del
  // navegador sigue funcionando igual — a un visitante en inglés se le
  // sigue llevando a /en.
  localePrefix: "as-needed",
});
