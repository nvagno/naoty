import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // L'indicateur de développement ne doit pas masquer le bouton de thème (en bas à gauche).
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
