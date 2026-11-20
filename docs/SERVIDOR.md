# Servidor (Fase 2)

Decisões 95 e 96. O mesmo projeto Next.js serve as telas e a API; os dados ficam no MySQL.

## Como funciona

- **Ações com nome** (`src/services/commands.ts`): a tela roda a ação na hora e manda ao servidor só o nome, os argumentos e os IDs gerados. O servidor repete **as mesmas regras** de `src/services` com a sessão dele.
- **Gravação** (`src/server/workshop-store.ts`): trava a oficina (`SELECT … FOR UPDATE` em `tenants`), repete as ações, grava só os registros que mudaram em `records` e sobe a versão. Duas pessoas ao mesmo tempo entram em fila.
- **Entrada** (`src/server/auth.ts`): o dono conecta o aparelho com e-mail e senha (cookie `gv_dev`, 400 dias); cada pessoa entra com o PIN (cookie `gv_ses`, 12 h). 5 senhas erradas = 15 min de espera; 5 PINs errados = 5 min. Senha e PIN só como resumo scrypt; nunca vão para o navegador.
- **Segurança das rotas** (`src/server/http.ts`): cookies `httpOnly`, `SameSite=Lax`, `Secure` em produção; todo POST exige o cabeçalho `x-gavyo: 1`; erros de regra viram a frase da regra, os outros viram frase genérica (detalhe só no log).

## Rotas

| Rota | O que faz |
|---|---|
| `POST /api/conectar` | Dono conecta o aparelho (e-mail, senha) e já entra |
| `GET /api/pessoas` | "Quem está entrando?" (nome, função, foto) |
| `POST /api/entrar` | Pessoa entra com o PIN |
| `POST /api/sair` | Sai (aparelho continua conectado) |
| `POST /api/desconectar` | Desconecta o aparelho |
| `GET /api/estado?v=` | Dados da oficina (204 se a versão não mudou) |
| `POST /api/acoes` | Lote de ações com nome |
| `POST /api/gavyo/oficinas` | Uso interno: cria oficina + dono (chave `GAVYO_ADMIN_KEY`) |

## Variáveis do servidor (nunca no código)

- `DATABASE_URL` — `mysql://usuario:senha@127.0.0.1:3306/banco` (na Hostinger, sempre 127.0.0.1).
- `GAVYO_ADMIN_KEY` — chave longa (24+ caracteres) para criar oficinas.

As tabelas são criadas sozinhas no primeiro acesso (`src/server/schema.ts`).

## Criar uma oficina

```bash
curl -X POST https://SEU-SITE/api/gavyo/oficinas -H "content-type: application/json" -H "x-gavyo: 1" \
  -H "authorization: Bearer $GAVYO_ADMIN_KEY" \
  -d '{"workshopName":"Oficina X","ownerName":"Fulano","ownerEmail":"fulano@x.com","ownerPassword":"senha-com-8+","ownerPin":"1234"}'
```

Com `"demo": true` (e só `ownerEmail`, `ownerPassword`, `ownerPin`), cria a Oficina Modelo Passaré com os dados de exemplo.

## Testes

`TEST_DATABASE_URL=mysql://… npx vitest run tests/server.test.ts` — **apaga as tabelas** do banco de teste. Cobre: senha e bloqueio, PIN, sessão presa ao aparelho, PIN gravado só como resumo, uma oficina não lê nem mexe na outra, duas baixas simultâneas da última peça (só uma passa).

## Ligar o site no servidor

`NEXT_PUBLIC_APP_MODE=production` **na hora do build** (é lida pelo navegador). Sem ela, o site é a demonstração no navegador. A tela usa `src/app-state/store.ts`, que escolhe entre `demoStore` e `serverStore` (decisão 97).
