import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Todo menos ficheros estáticos, internals de Next y las rutas de API
  // (los crons no tienen ni necesitan idioma).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
