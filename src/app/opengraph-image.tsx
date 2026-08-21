import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";
export const alt = "PosMarket - Marketplace Express Premium";

export default function OpengraphImage() {
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
          background: "linear-gradient(135deg, #fff7f2 0%, #ffe8dc 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: "rgba(245,107,42,0.15)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -140,
            left: -60,
            width: 380,
            height: 380,
            borderRadius: 9999,
            background: "rgba(245,107,42,0.10)",
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            borderRadius: 36,
            background: "#f56b2a",
            color: "white",
            fontSize: 64,
            marginBottom: 40,
            boxShadow: "0 20px 50px rgba(245,107,42,0.35)",
          }}
        >
          🛒
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 900,
            color: "#111827",
            letterSpacing: -2,
          }}
        >
          Pos<span style={{ color: "#f56b2a", display: "flex" }}>Market</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 32,
            fontWeight: 700,
            color: "#6b7280",
            marginTop: 16,
            textTransform: "uppercase",
            letterSpacing: 8,
          }}
        >
          Local &amp; Express
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 48,
            padding: "14px 40px",
            borderRadius: 9999,
            background: "#111827",
            color: "white",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          Achetez et vendez en toute sécurité
        </div>
      </div>
    ),
    { ...size },
  );
}
