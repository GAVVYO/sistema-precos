# Publicar na Hostinger

## Servidor (atual, desde 20/11 — decisão 100)

O **demo.gavyo.me** roda o sistema com servidor: app Node.js na Hostinger + banco MySQL `u371477998_auto` (os bancos do gavyo.me não são tocados). As oficinas são criadas em **demo.gavyo.me/gavyo**.

**Por que montar antes de enviar:** no build da Hostinger o Turbopack não consegue abrir o processo auxiliar que monta o CSS (falha "node process exited before we could connect"). Então o site é montado fora, no formato **standalone**, e a Hostinger só instala e liga.

1. Montar (numa cópia limpa do repositório, sem `mobile/`, `docs/`, `tests/`):

```bash
npm ci
```

```bash
npm run build:servidor
```

2. Compactar a pasta inteira **sem** `node_modules/` da raiz e sem `.next/cache` (o `.next/standalone/node_modules` vai junto).
3. Enviar o zip para o `public_html` de demo.gavyo.me (Gerenciador de arquivos ou API de upload).
4. Montar como Node.js: Node 22, tipo **Next.js**, comando de build **`build:pronto`** (só confere se o servidor montado veio no pacote), saída `.next`.
5. Variáveis do app (painel › Node.js › Variáveis): `DATABASE_URL`, `GAVYO_ADMIN_KEY`, `NEXT_PUBLIC_APP_MODE=production`. Ver [SERVIDOR.md](SERVIDOR.md). As fotos ficam em `~/gavyo-arquivos` (fora do `public_html`; uma publicação nova não apaga).

As tabelas são criadas sozinhas no primeiro acesso.

---

## Demonstração estática (antiga, Fase 1)

A demonstração (Fase 1) **não usa servidor**: é HTML, CSS e JavaScript, e os dados ficam no navegador de cada pessoa. Por isso funciona em **qualquer plano da Hostinger**, inclusive a hospedagem compartilhada, sem Node.js e sem banco.

> ⚠️ É uma demonstração com dados fictícios. Cada visitante vê os dados de demonstração no próprio navegador; nada é compartilhado entre computadores e **não deve ser usada com dados reais de clientes**. Para uso de verdade, ver a Fase 2 em [ROADMAP.md](ROADMAP.md) (precisa de plano com Node.js ou VPS + MySQL).

## 1. Gerar os arquivos (no seu computador)

```bash
git pull
```

```bash
npm ci
```

```bash
npm run build:hostinger
```

Resultado:
- pasta `out/` com o site pronto;
- `gavyo-hostinger.zip` (o conteúdo de `out/`, já com `.htaccess` e `robots.txt`).

O `.htaccess` força HTTPS, usa a página 404 do sistema, guarda em cache os arquivos com hash (`/_next/static/`) e nunca guarda o HTML, para cada nova versão aparecer na hora. O `robots.txt` pede para o Google não indexar a demonstração.

## 2. Enviar (hPanel)

1. hPanel › **Sites** › escolha o domínio ou crie um **subdomínio** (sugestão: `demo.seudominio.com.br`).
2. **Gerenciador de arquivos** › abra `public_html` do domínio/subdomínio. Apague o `default.php`/`index.html` de exemplo, se houver.
3. **Enviar** › `gavyo-hostinger.zip` › clique com o botão direito › **Extrair** para a própria `public_html`.
   - Os arquivos devem ficar direto em `public_html` (`public_html/index.html`, `public_html/login/`, `public_html/_next/`…), não dentro de uma subpasta.
   - O `.htaccess` começa com ponto: se não aparecer, ative "mostrar arquivos ocultos".
4. hPanel › **Segurança › SSL**: confirme o certificado ativo (gratuito) para o domínio/subdomínio.
5. Abra `https://seu-endereco/` → deve ir para a tela de acesso.

Alternativa por FTP: envie o **conteúdo** de `out/` para `public_html` (FileZilla, com arquivos ocultos visíveis).

## 3. Atualizar depois

Repita o passo 1 e envie de novo, substituindo os arquivos (pode apagar o conteúdo antigo de `public_html` antes, menos o que não for do site). Como o HTML não fica em cache, a versão nova aparece ao recarregar.

## 4. Conferir depois de publicar

- Entrar como Proprietário, abrir **Serviços**, recarregar a página (F5) — deve continuar em Serviços.
- Endereço inexistente (`/xyz`) mostra a página 404 do sistema.
- O cadeado (HTTPS) aparece.
- Animações: Chrome/Edge e Safari 18+; nos demais, as mudanças acontecem sem animação.

## Verificado antes de publicar

`npm run build:hostinger` gera 14 páginas; servido por um servidor de arquivos simples (sem Node), as 4 tarefas da [validação sem treino](validacao/SEM-TREINO-20261117.md) foram concluídas em 1366 e 390 px, axe sem violações, e recarregar páginas internas funciona. Não testado no servidor da Hostinger em si (feito pelo dono da conta).

**20/11:** republicado pelo painel da Hostinger (envio do `gavyo-hostinger.zip` e extração em `public_html` de demo.gavyo.me). Conferido no ar: 7 telas × 7 situações sem erro e axe limpo, as 4 tarefas da validação concluídas, páginas internas e 404 respondendo.
