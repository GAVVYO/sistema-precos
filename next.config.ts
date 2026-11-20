import type { NextConfig } from "next";

/**
 * Na fase 1 toda a aplicação é renderizada no cliente a partir dos dados de
 * demonstração locais; por isso `cacheComponents`/`partialPrefetching` (que
 * validam o conteúdo pré-renderizado de cada rota) ficam desligados. Reavaliar
 * na fase 2, quando as telas passarem a buscar dados no servidor.
 */
/**
 * `STATIC_EXPORT=1` (npm run build:hostinger) gera a pasta `out/` com HTML, CSS e JS
 * prontos para qualquer hospedagem (inclusive a compartilhada da Hostinger):
 * a demonstração não usa servidor. `trailingSlash` cria `pagina/index.html`,
 * que o Apache serve sem regras extras. Na fase 2 (backend) voltará a precisar de Node.
 */
const staticExport = process.env.STATIC_EXPORT === "1";
/**
 * Servidor (decisão 100): a Hostinger roda o `server.js` do formato standalone.
 * O build:servidor copia `public` e `.next/static` para dentro dele.
 */
const standalone = process.env.STANDALONE === "1";

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" as const, trailingSlash: true, images: { unoptimized: true } } : {}),
  ...(standalone ? { output: "standalone" as const } : {}),
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
