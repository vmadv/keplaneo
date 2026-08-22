import Breadcrumb, { type BreadcrumbItem } from "./Breadcrumb";
import PlanList from "./PlanList";
import MunicipioPageNav from "./MunicipioPageNav";
import type { Plan } from "@/lib/types";
import type { MunicipioConComunidad } from "@/lib/queries";

export default function PlanesPageLayout({
  municipio,
  comunidadSlug,
  municipioSlug,
  titulo,
  planes,
  current,
  breadcrumbExtra,
}: {
  municipio: MunicipioConComunidad;
  comunidadSlug: string;
  municipioSlug: string;
  titulo: string;
  planes: Plan[];
  current: { vigencia: "hoy" | "finde"; audiencia?: "pareja" | "familia" };
  breadcrumbExtra: BreadcrumbItem[];
}) {
  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: "Inicio", href: "/" },
            { label: municipio.comunidad.nombre, href: `/${comunidadSlug}` },
            { label: municipio.nombre, href: `/${comunidadSlug}/${municipioSlug}` },
            ...breadcrumbExtra,
          ]}
        />
        <h1 className="text-4xl font-extrabold mt-4 mb-8 text-balance">{titulo}</h1>
        <PlanList planes={planes} base={`/${comunidadSlug}/${municipioSlug}`} />
        <MunicipioPageNav
          comunidadSlug={comunidadSlug}
          municipioSlug={municipioSlug}
          municipioNombre={municipio.nombre}
          current={current}
        />
      </div>
    </main>
  );
}
