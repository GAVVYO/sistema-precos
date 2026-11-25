# Auditoria do back-end — Plano de correções

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os problemas encontrados na auditoria completa do servidor (`src/server`, `src/app/api`) e da fila de envio do navegador (`src/app-state/server-store.ts`).

**Architecture:** Correções pequenas e independentes, uma por tarefa, sem mudar o desenho (ações com nome repetidas no servidor, trava por oficina, tabela `records`). Cada uma vem com teste: os que precisam de banco entram em `tests/server.test.ts` (rodam com `TEST_DATABASE_URL`); o resto vira teste puro que roda sempre.

**Tech Stack:** Next.js 16.4 route handlers, `mysql2/promise`, `node:crypto`, Zod 4, Vitest 5.

**Spec:** Pedido do usuário (2026-11-25): "fazer o back-end completo procurando os problemas e consertando eles". Achados na seção **Achados**; referência do desenho: `docs/SERVIDOR.md`.

## Achados

| # | Gravidade | Onde | Problema |
|---|---|---|---|
| 1 | **Alta (segurança)** | `src/server/admin.ts:117` `resetOwnerPassword` | O comentário promete "desconecta os aparelhos (quem tinha a senha antiga sai)", mas o código só troca a senha: quem roubou a senha continua conectado por até 400 dias. |
| 2 | **Alta** | `src/app-state/server-store.ts:109` `flush` | Se `res.json()` falhar (resposta cortada/proxy), a exceção escapa e `sending` fica `true` para sempre: nada mais é enviado e a tela parece salva. Também: 502/503/504 (Hostinger reiniciando) **descartam** a ação em vez de tentar de novo. |
| 3 | Média | `src/server/secrets.ts` | `scryptSync` trava o servidor inteiro (~50–100 ms) a cada senha/PIN conferido. E-mail inexistente responde mais rápido que senha errada (dá para descobrir quais e-mails existem). |
| 4 | Média | `src/server/http.ts:51` `body` | Sem limite de tamanho: um pedido gigante é lido inteiro na memória. |
| 5 | Média | `src/server/provision.ts:64` `createDemoWorkshop` | Criar a demonstração pela 2ª vez dá erro genérico 500 (id fixo `DEMO_WORKSHOP_ID`); PIN não é validado (PIN "12345" cria uma oficina onde ninguém entra). |
| 6 | Baixa | `sessions`, `attempts` | Sessões vencidas e tentativas antigas nunca são apagadas; a tabela só cresce. |
| 7 | Baixa (desempenho) | `src/server/workshop-store.ts` `readState`, `write` | Cada busca com versão nova faz 2 cópias profundas da oficina inteira (`structuredClone` + `stripSecrets`) por aparelho; `readState` lê versão e registros fora de uma foto consistente; `write` faz 1 `INSERT` por registro (criar a demo = centenas de idas ao banco). |
| 8 | Baixa | `next.config.ts` | Sem cabeçalhos de segurança (site pode ser aberto dentro de `<iframe>` de outro site). |

Fora do escopo (anotado, sem mudança): bloqueio global da chave da GAVYO (5 erros bloqueiam todos por 15 min — aceitável, chave ≥ 24 caracteres); busca por `JSON_VALUE` no `connectDevice` sem índice (poucas oficinas hoje).

## Global Constraints

- Mensagens ao usuário em português simples, no tom das existentes ("Muitas tentativas erradas. Espere…").
- Não mudar o formato dos resumos guardados (`scrypt$<sal>$<resumo>`, 32 bytes, parâmetros padrão do Node): senhas e PINs já gravados continuam valendo.
- Não mudar rotas, nomes de cookie nem o formato das respostas que a tela já lê.
- Testes de banco: `TEST_DATABASE_URL=mysql://… npx vitest run tests/server.test.ts` (**apaga as tabelas** do banco de teste). Esta máquina não tem MySQL: se o executor também não tiver, escrever o teste, rodar o resto, e dizer no relatório que o teste de banco ficou sem rodar.
- `npm run lint`, `npm run typecheck` e `npm test` passam ao fim de cada tarefa.

## Review Focus

1. **Senhas antigas continuam entrando** depois da troca para scrypt assíncrono — teste na Tarefa 3 com um resumo gerado pelo `scryptSync` antigo.
2. **Ação na fila durante reinício do servidor** (502/503/504 seguidos e depois 200) não some nem é enviada duas vezes — teste na Tarefa 2.
3. **Aparelho do dono depois da troca de senha** volta a pedir e-mail e senha (sessões e aparelhos apagados) — teste na Tarefa 1.
4. **Lote com várias fotos** (até o limite atual de 2 MB por foto) continua passando no limite de tamanho — teste na Tarefa 4.
5. **Duas abas pedindo `/api/estado`** na mesma versão recebem os mesmos dados, sem PIN nem resumo de senha — teste na Tarefa 6.

---

## Estrutura de arquivos

- Modificar `src/server/admin.ts`, `src/server/secrets.ts`, `src/server/auth.ts`, `src/server/http.ts`, `src/server/provision.ts`, `src/server/workshop-store.ts`, `src/app-state/server-store.ts`, `next.config.ts`, `docs/SERVIDOR.md`.
- Criar `tests/secrets.test.ts`, `tests/http.test.ts`, `tests/provision.test.ts`, `tests/server-store.test.ts`, `tests/next-config.test.ts`.
- Acrescentar casos em `tests/server.test.ts`.

---

### Task 1: Trocar a senha do dono desconecta os aparelhos

**Files:**
- Modify: `src/server/admin.ts:117-125`
- Test: `tests/server.test.ts`

- [ ] **Step 1: Teste** — no bloco `servidor com MySQL` (acrescentar `ownerSession` ao import de `@/server/auth`):

```ts
it("trocar a senha do dono desconecta os aparelhos e encerra as sessões", async () => {
  const dev = await connectDevice(EMAIL_A, SENHA_A); // usar as constantes já existentes no arquivo
  const ses = await ownerSession(dev.token, dev.workshopId, dev.userId);
  await resetOwnerPassword(A.workshopId, "outra-senha-boa-123");
  expect(await deviceOf(dev.token)).toBeNull();
  expect(await sessionOf(dev.token, ses.token)).toBeNull();
  await expectCode(connectDevice(EMAIL_A, SENHA_A), "forbidden");
  expect((await connectDevice(EMAIL_A, "outra-senha-boa-123")).workshopId).toBe(A.workshopId);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/server.test.ts -t "trocar a senha"` → FAIL (`deviceOf` ainda devolve o aparelho). Sem banco: anotar "pulado".

- [ ] **Step 3: Corrigir** — na mesma transação de `resetOwnerPassword`, `DELETE FROM sessions WHERE workshop_id = ?` e `DELETE FROM devices WHERE workshop_id = ?`. Atualizar o texto da tela em `src/features/gavyo/gavyo-admin.tsx` se ele não avisar que os aparelhos serão desconectados ("Os aparelhos da oficina vão pedir o e-mail e a senha de novo.").

- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS.

- [ ] **Step 5: Commit** — `git commit -am "fix(servidor): trocar a senha do dono desconecta os aparelhos"`

---

### Task 2: Fila de envio nunca trava e aguenta o servidor reiniciando

**Files:**
- Modify: `src/app-state/server-store.ts:109-146`
- Test: `tests/server-store.test.ts`

**Interfaces:**
- Produces: constante `RETRY_STATUS = new Set([502, 503, 504])` e espera crescente `retryDelay(attempt: number): number` = `min(4000 * 2 ** attempt, 30000)` exportadas de `server-store.ts`.

- [ ] **Step 1: Teste** (Vitest, `vi.useFakeTimers()`, `vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }))`, `globalThis.fetch = vi.fn()` e stubs mínimos de `window`/`document` com `visibilityState: "visible"`):

```ts
it("503, 503 e depois 200: a ação é enviada de novo, uma vez só, e a fila esvazia", async () => { /*
  fetch: /api/estado → 200 com { session, version: 1, db: <emptyDatabase com a oficina e o membro> };
  /api/acoes → 503, 503, 200 { from: 1, version: 2, changes: { upserts: {}, deletes: {} } }.
  await serverStore.reload(); serverStore.run(c => c.<qualquer ação simples>);
  avançar timers retryDelay(0) e retryDelay(1);
  expect(chamadas a /api/acoes).toBe(3); expect(serverStore.pending()).toBe(0); expect(toast).not.toHaveBeenCalledWith("error", expect.anything()); */ });
it("resposta 200 com corpo inválido não trava a fila", async () => { /*
  /api/acoes → 200 com corpo "<html>"; depois a próxima ação → 200 válido.
  expect: a 2ª ação é enviada (fetch chamado de novo) e pending() chega a 0. */ });
it("retryDelay cresce e para em 30 s", () => {
  expect([0, 1, 2, 3, 9].map(retryDelay)).toEqual([4000, 8000, 16000, 30000, 30000]);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/server-store.test.ts` → FAIL.

- [ ] **Step 3: Corrigir `flush`** — todo o corpo depois de marcar `sending = true` dentro de `try { … } finally { sending = false }`; o `void flush()` seguinte fora do `finally` e só quando não houver espera agendada. Rede caída **ou** status em `RETRY_STATUS`: mantém o lote na frente da fila, `connection: "reconnecting"` e agenda nova tentativa com `retryDelay(tentativas++)` (zerar ao dar certo). `res.ok` com JSON inválido: tirar o lote da fila e chamar `pull(true)` (o servidor pode ter gravado; a versão dele manda). O resto do comportamento fica igual.

- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS; `npm test` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "fix(sincronização): fila não trava e tenta de novo quando o servidor reinicia"`

---

### Task 3: Senha e PIN conferidos sem travar o servidor

**Files:**
- Modify: `src/server/secrets.ts`, `src/server/auth.ts`, `src/server/admin.ts`, `src/server/workshop-store.ts` (quem chama `hashSecret`/`checkSecret`)
- Test: `tests/secrets.test.ts`

**Interfaces:**
- Produces (troca a assinatura; todos os chamadores passam a usar `await`):
  - `hashSecret(value: string): Promise<string>`
  - `checkSecret(value: string, stored: string | null | undefined): Promise<boolean>` — sem resumo válido, confere contra um resumo falso fixo (mesmo tempo) e devolve `false`.

- [ ] **Step 1: Teste**

```ts
// tests/secrets.test.ts
import { scryptSync, randomBytes } from "node:crypto";
import { checkSecret, hashSecret, isHashed } from "@/server/secrets";
it("resumo novo confere", async () => {
  const h = await hashSecret("1234");
  expect(isHashed(h)).toBe(true);
  expect(await checkSecret("1234", h)).toBe(true);
  expect(await checkSecret("4321", h)).toBe(false);
});
it("resumo antigo (scryptSync) continua valendo", async () => {
  const salt = randomBytes(16).toString("base64url");
  const old = `scrypt$${salt}$${scryptSync("senha-antiga-1", salt, 32).toString("base64url")}`;
  expect(await checkSecret("senha-antiga-1", old)).toBe(true);
});
it("sem resumo ou resumo estragado: false, sem lançar erro", async () => {
  for (const s of [null, undefined, "", "texto", "scrypt$", "scrypt$a$"]) expect(await checkSecret("x", s)).toBe(false);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/secrets.test.ts` → FAIL (retorno não é Promise / resumo estragado lança).

- [ ] **Step 3: Implementar** com `promisify(scrypt)` de `node:crypto`. Em `connectDevice`, quando o e-mail não existe, chamar `checkSecret(password, null)` antes de registrar a falha (mesmo tempo de resposta). Ajustar `hashNewPins` (vira `async`) e os `UPDATE … password_hash` de `insertWorkshop`/`resetOwnerPassword`.

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run tests/secrets.test.ts` → PASS; `npm run typecheck` → sem erros (pega chamador esquecido sem `await`).

- [ ] **Step 5: Commit** — `git commit -am "perf(servidor): conferir senha e PIN sem travar o servidor"`

---

### Task 4: Proteções das rotas — limite de tamanho e cabeçalhos

**Files:**
- Modify: `src/server/http.ts:51-57`, `next.config.ts`
- Test: `tests/http.test.ts`, `tests/next-config.test.ts`

**Interfaces:**
- Produces: `export const MAX_BODY_BYTES = 12_000_000` em `http.ts` (cabe um lote com 4 fotos de 2 MB em base64 com folga).

- [ ] **Step 1: Testes**

```ts
// tests/http.test.ts
import { NextRequest } from "next/server";
import { body, MAX_BODY_BYTES } from "@/server/http";
const req = (text: string, headers: Record<string, string> = {}) =>
  new NextRequest("http://x/api/acoes", { method: "POST", body: text, headers: { "content-type": "application/json", ...headers } });
it("aceita lote com 4 fotos de 2 MB", async () => {
  const foto = "A".repeat(Math.ceil((2_000_000 * 4) / 3));
  expect((await body<{ f: string[] }>(req(JSON.stringify({ f: [foto, foto, foto, foto] })))).f).toHaveLength(4);
});
it("recusa acima do limite pelo content-length, sem ler o corpo", async () => {
  await expect(body(req("{}", { "content-length": String(MAX_BODY_BYTES + 1) }))).rejects.toThrow("Pedido grande demais");
});
it("recusa acima do limite mesmo sem content-length", async () => {
  await expect(body(req(JSON.stringify({ x: "A".repeat(MAX_BODY_BYTES) })))).rejects.toThrow("Pedido grande demais");
});
it("JSON inválido continua 'Pedido inválido.'", async () => {
  await expect(body(req("{"))).rejects.toThrow("Pedido inválido.");
});
```

```ts
// tests/next-config.test.ts
it("servidor manda cabeçalhos de segurança", async () => {
  const { default: cfg } = await import("../next.config");
  const all = (await cfg.headers!()).flatMap((h) => h.headers.map((x) => x.key.toLowerCase()));
  expect(all).toEqual(expect.arrayContaining(["x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy"]));
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/http.test.ts tests/next-config.test.ts` → FAIL.

- [ ] **Step 3: Implementar**
  - `body`: se `content-length` > `MAX_BODY_BYTES` → `DomainError("validation", "Pedido grande demais. Envie menos fotos de uma vez.")`; senão `await req.text()`, conferir `text.length` contra o mesmo limite, depois `JSON.parse` (erro → "Pedido inválido.").
  - `next.config.ts`: `headers()` com `source: "/:path*"` e `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()` (câmera fica liberada: o app tira foto e lê QR). Só incluir `headers` quando **não** for `STATIC_EXPORT` (o export estático não aceita). Conferir a forma em `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md` antes.

- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS; `STATIC_EXPORT=1 npx next build` não avisa sobre `headers`.

- [ ] **Step 5: Commit** — `git commit -am "fix(servidor): limite de tamanho do pedido e cabeçalhos de segurança"`

---

### Task 5: Criar demonstração com erro claro e PIN válido

**Files:**
- Modify: `src/server/provision.ts:64-83`, `src/app/api/gavyo/oficinas/route.ts:31`
- Test: `tests/provision.test.ts`, `tests/server.test.ts`

- [ ] **Step 1: Testes**

```ts
// tests/provision.test.ts (não precisa de banco: a validação vem antes de qualquer consulta)
import { createDemoWorkshop } from "@/server/provision";
for (const pin of ["123", "12345", "abcd", ""]) {
  it(`PIN "${pin}" é recusado`, async () => {
    await expect(createDemoWorkshop("dono@x.com", "senha-boa-123", pin)).rejects.toThrow("O PIN tem 4 números.");
  });
}
```

```ts
// tests/server.test.ts, dentro do bloco com banco, depois do teste que já cria a demo
it("criar a demonstração de novo dá aviso claro, não erro 500", async () => {
  await expectCode(createDemoWorkshop("outro@x.com", "senha-boa-123", "1234"), "conflict");
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/provision.test.ts` → FAIL.

- [ ] **Step 3: Corrigir** — validar o PIN com o mesmo esquema de `newWorkshopSchema.shape.ownerPin` como primeira linha; antes de montar a semente, `SELECT 1 FROM tenants WHERE id = ?` com `DEMO_WORKSHOP_ID` → `DomainError("conflict", "A oficina de demonstração já existe. Use a que está na lista.")`. Na rota, tirar o `?? "1234"` silencioso só se a tela da GAVYO sempre manda o PIN; se não manda, manter o padrão `"1234"` (que é válido).

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run tests/provision.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "fix(servidor): demonstração com PIN válido e aviso quando já existe"`

---

### Task 6: Servidor mais leve — limpeza, estado pronto por versão e gravação em lote

**Files:**
- Modify: `src/server/auth.ts`, `src/server/workshop-store.ts`, `src/app/api/estado/route.ts`, `docs/SERVIDOR.md`
- Test: `tests/server.test.ts`

**Interfaces:**
- Produces: `readState` mantém a assinatura; por dentro guarda, por oficina, `{ version, json: string }` com o banco **já sem segredos e já em texto**. A rota `/api/estado` passa a montar a resposta com esse texto (`new NextResponse('{"session":…,"version":…,"db":' + json + '}', { headers: { "content-type": "application/json" } })`) — formato da resposta igual ao de hoje.
- Produces: `export async function purgeExpired(c: PoolConnection): Promise<void>` em `auth.ts`.

- [ ] **Step 1: Testes** (banco):

```ts
it("sessões vencidas e tentativas antigas são apagadas ao entrar", async () => { /*
  inserir direto: 1 sessão com expires_at no passado e 1 attempt com updated_at de 2 dias atrás e blocked_until NULL;
  fazer um pinLogin válido; expect: as duas linhas sumiram; sessões válidas e bloqueios ativos continuam. */ });
it("duas buscas na mesma versão devolvem os mesmos dados, sem PIN nem resumo", async () => { /*
  const a = await readState(A.workshopId, A.ownerId); const b = await readState(A.workshopId, A.ownerId);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  expect(JSON.stringify(a)).not.toMatch(/scrypt\$/); */ });
it("criar a demonstração grava tudo (gravação em lote)", async () => { /*
  contar linhas em records da oficina demo == total de registros da semente (+1 do contador). */ });
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/server.test.ts` → FAIL no teste de limpeza (sem banco: anotar "pulado").

- [ ] **Step 3: Implementar**
  - `purgeExpired`: `DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP() LIMIT 500` e `DELETE FROM attempts WHERE (blocked_until IS NULL OR blocked_until < UTC_TIMESTAMP()) AND updated_at < UTC_TIMESTAMP() - INTERVAL 1 DAY LIMIT 500`; chamar no fim de `pinLogin` e `connectDevice` bem-sucedidos.
  - `readState`: rodar dentro de `START TRANSACTION READ ONLY WITH CONSISTENT SNAPSHOT` … `COMMIT` (versão e registros da mesma foto). Guardar o texto sem segredos por versão; a conferência de quem é da oficina continua (usa o `Database` em cache, sem clonar).
  - `write`: agrupar os upserts de cada tipo em `INSERT … VALUES (?,?,?,?),(…) ON DUPLICATE KEY UPDATE data = VALUES(data)` em blocos de 200 linhas; usuários continuam um a um (precisam do aviso de e-mail repetido).

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run tests/server.test.ts` → PASS (ou "pulado" sem banco); `npm test` → PASS.

- [ ] **Step 5: Atualizar `docs/SERVIDOR.md`** — linha sobre limpeza automática, limite de 12 MB por pedido, cabeçalhos de segurança, troca de senha desconecta aparelhos, novos testes.

- [ ] **Step 6: Commit** — `git commit -am "perf(servidor): limpeza automática, estado pronto por versão e gravação em lote"`
