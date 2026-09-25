import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serveur autonome (.next/standalone) embarqué dans l'application Electron,
  // produit uniquement par scripts/electron-prepare.mjs (`next start` n'en veut pas).
  output: process.env.CARNET_STANDALONE ? "standalone" : undefined,
  // Les données personnelles (data/) ne doivent jamais être copiées dans le build.
  outputFileTracingExcludes: { "/*": ["./data/**/*"] },
  // L'indicateur de développement ne doit pas masquer le bouton de thème (en bas à gauche).
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
