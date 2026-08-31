import { ImageResponse } from "next/og";

// Monograma "K" en círculo violeta con borde grueso azul marino — mismo
// estilo "Playful Geometric" del resto del sitio (ver opengraph-image.tsx),
// elegido en conversación entre varias propuestas de logo circular.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "#8b5cf6",
            border: "2.5px solid #1e293b",
            fontFamily: "sans-serif",
            fontWeight: 900,
            fontSize: 20,
            color: "#fffdf5",
          }}
        >
          K
        </div>
      </div>
    ),
    { ...size }
  );
}
