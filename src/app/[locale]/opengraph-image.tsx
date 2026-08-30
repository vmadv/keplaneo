import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

// Genérica, para páginas sin municipio propio (home, rankings, elige-
// ciudad...) — las de un municipio concreto tienen la suya en
// [municipio]/opengraph-image.tsx, más específica y que Next prioriza
// automáticamente por convención de carpetas.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Sitio" });

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
          padding: "0 100px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "#8b5cf6",
            marginBottom: 48,
          }}
        />
        <div style={{ display: "flex", fontSize: 96, fontWeight: 800, color: "#1e293b" }}>Keplaneo</div>
        <div style={{ display: "flex", fontSize: 34, color: "#1e293b", marginTop: 20, opacity: 0.7 }}>
          {t("descripcion")}
        </div>
      </div>
    ),
    { ...size }
  );
}
