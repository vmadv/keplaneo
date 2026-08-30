import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { getMunicipio } from "@/lib/queries";

// Se aplica por convención de carpetas a esta página Y a todas sus hijas
// (hoy, fin-de-semana, categorías, eventos...) que no declaren la suya
// propia — un cartel genérico por municipio es suficiente aquí, no hace
// falta una imagen distinta por cada vigencia/categoría.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; municipio: string }>;
}) {
  const { locale, municipio: municipioSlug } = await params;
  const [municipio, t] = await Promise.all([
    getMunicipio(municipioSlug),
    getTranslations({ locale, namespace: "MunicipioHome" }),
  ]);
  const nombre = municipio?.nombre ?? municipioSlug;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fffdf5",
          fontFamily: "sans-serif",
          padding: "0 80px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 40,
          }}
        >
          <div style={{ display: "flex", width: 22, height: 22, borderRadius: "50%", background: "#8b5cf6" }} />
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: "#1e293b" }}>keplaneo</div>
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, color: "#1e293b", lineHeight: 1.1 }}>
          {t("titulo", { municipio: nombre })}
        </div>
      </div>
    ),
    { ...size }
  );
}
