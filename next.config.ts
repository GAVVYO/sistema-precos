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

/**
 * Cabeçalhos de segurança (só com servidor; o export estático não os aceita):
 * o site não abre dentro de <iframe> de outro site, o navegador não "adivinha"
 * o tipo de arquivo e o endereço não vaza para outros sites. A câmera fica
 * liberada para o próprio site (foto do serviço e leitura do QR).
 */
const securityHeaders = async () => [
  {
    source: "/:path*",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ],
  },
];

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" as const, trailingSlash: true, images: { unoptimized: true } } : { headers: securityHeaders }),
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
