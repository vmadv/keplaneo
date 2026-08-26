import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Link/usePathname/useRouter conscientes del idioma: se usan en vez de los
// de next/link o next/navigation en todo el sitio, así ninguna URL interna
// necesita construirse a mano con el prefijo /es o /en — lo añade solo.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
