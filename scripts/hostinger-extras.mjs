// Acrescenta à pasta out/ o .htaccess para a Hostinger (Apache/LiteSpeed):
// página 404, HTTPS, cache longo só para arquivos com hash e nenhum cache no HTML.
import { writeFileSync } from "node:fs";

writeFileSync(
  "out/.htaccess",
  `# Gerado por npm run build:hostinger
Options -Indexes
DirectoryIndex index.html
ErrorDocument 404 /404.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} !=on
  RewriteCond %{HTTP:X-Forwarded-Proto} !=https
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

<IfModule mod_headers.c>
  <FilesMatch "\\.(html)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  <If "%{REQUEST_URI} =~ m#^/_next/static/#">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </If>
  Header set X-Content-Type-Options "nosniff"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
</IfModule>
`,
);
console.log("out/.htaccess criado. Envie o CONTEÚDO de out/ para public_html.");

// Demonstração não deve aparecer no Google.
writeFileSync("out/robots.txt", "User-agent: *\nDisallow: /\n");

// Zip pronto para o Gerenciador de Arquivos da Hostinger (extrair dentro de public_html).
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
rmSync("gavyo-hostinger.zip", { force: true });
try {
  execSync("zip -rqX ../gavyo-hostinger.zip .", { cwd: "out", stdio: "inherit" });
  console.log("gavyo-hostinger.zip pronto (conteúdo de out/, com .htaccess).");
} catch {
  console.log("Comando zip indisponível: compacte o conteúdo de out/ manualmente.");
}
