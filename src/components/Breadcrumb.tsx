import { ChevronRight } from "lucide-react";
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { urlAbsoluta } from "@/lib/rutasLocale";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default async function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  // Schema.org exige que `item` sea una URL absoluta — una ruta relativa
  // como "/sevilla" no es válida ahí, y algunos extractores (LLMs
  // incluidos) leen el JSON-LD fuera del contexto de la página, sin base
  // para resolverla (ver conversación).
  const locale = await getLocale();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: urlAbsoluta(locale, item.href) } : {}),
    })),
  };

  return (
    <nav aria-label="Ruta de navegación" className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />}
            {item.href ? (
              <Link href={item.href} className="hover:underline decoration-2 underline-offset-2">
                {item.label}
              </Link>
            ) : (
              <span style={{ color: "var(--foreground)" }}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </nav>
  );
}
