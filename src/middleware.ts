import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Todo menos ficheros estáticos, internals de Next y las rutas de API
  // (los crons no tienen ni necesitan idioma). "icon"/"apple-icon" se
  // excluyen aparte: son convenciones especiales de Next.js que resuelven
  // a una URL sin punto (/icon, no /icon.png), así que el patrón de
  // "ficheros estáticos" (.*\..*) no las pilla — sin esto, el propio
  // middleware las interceptaba como si fueran una página y devolvía 404
  // (bug real encontrado en conversación, al añadir icon.tsx).
  matcher: ["/((?!api|_next|_vercel|icon|apple-icon|.*\\..*).*)"],
};
