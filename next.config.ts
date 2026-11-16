import type { NextConfig } from "next";

/**
 * Na fase 1 toda a aplicação é renderizada no cliente a partir dos dados de
 * demonstração locais; por isso `cacheComponents`/`partialPrefetching` (que
 * validam o conteúdo pré-renderizado de cada rota) ficam desligados. Reavaliar
 * na fase 2, quando as telas passarem a buscar dados no servidor.
 */
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
