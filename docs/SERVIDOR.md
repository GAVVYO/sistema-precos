# Servidor (Fase 2)

Decisões 95 e 96. O mesmo projeto Next.js serve as telas e a API; os dados ficam no MySQL.

## Como funciona

- **Ações com nome** (`src/services/commands.ts`): a tela roda a ação na hora e manda ao servidor só o nome, os argumentos e os IDs gerados. O servidor repete **as mesmas regras** de `src/services` com a sessão dele.
- **Gravação** (`src/server/workshop-store.ts`): trava a oficina (`SELECT … FOR UPDATE` em `tenants`), repete as ações, grava só os registros que mudaram em `records` e sobe a versão. Duas pessoas ao mesmo tempo entram em fila.
- **Entrada** (`src/server/auth.ts`): o dono conecta o aparelho com e-mail e senha (cookie `gv_dev`, 400 dias); cada pessoa entra com o PIN (cookie `gv_ses`, 12 h). 5 senhas erradas = 15 min de espera; 5 PINs errados = 5 min. Senha e PIN só como resumo scrypt; nunca vão para o navegador.
- **Segurança das rotas** (`src/server/http.ts`): cookies `httpOnly`, `SameSite=Lax`, `Secure` em produção; todo POST exige o cabeçalho `x-gavyo: 1`; erros de regra viram a frase da regra, os outros viram frase genérica (detalhe só no log).
- **Tamanho e cabeçalhos:** pedido acima de 12 MB é recusado ("Pedido grande demais") antes de ser lido inteiro. O servidor manda `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` e `Permissions-Policy` (câmera só para o próprio site) — `next.config.ts`, só fora do export estático.
- **Senha e PIN** conferidos com scrypt assíncrono (não trava o servidor). E-mail que não existe confere contra um resumo falso: a resposta demora o mesmo que senha errada.
- **Trocar a senha do dono** (Área da GAVYO) desconecta todos os aparelhos da oficina: todos pedem e-mail e a senha nova.
- **Limpeza automática:** a cada entrada bem-sucedida, sessões vencidas e tentativas erradas com mais de 1 dia (sem bloqueio ativo) são apagadas, em lotes de 500.
- **Estado pronto por versão:** `/api/estado` monta o texto da oficina (sem segredos) uma vez por versão e reaproveita para todos os aparelhos; versão e registros vêm da mesma foto do banco. A gravação junta até 200 registros por ida ao banco.
- **Fila no navegador** (`src/app-state/server-store.ts`): resposta 502/503/504 ou sem internet → a ação fica na fila e vai de novo em 4, 8, 16… até 30 s; resposta cortada não trava a fila (busca a versão do servidor).

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
| `GET /api/arquivos/:oficina/:nome` | Foto ou logo (só para quem está na oficina) |
| `POST /api/gavyo/entrar` | Área da GAVYO: entra com a chave (cookie 8 h) |
| `GET/POST /api/gavyo/oficinas` | Lista / cria oficina + dono (cookie da área ou `Bearer GAVYO_ADMIN_KEY`) |
| `POST /api/gavyo/oficinas/:id` | Trocar senha do dono / ativar ou desativar |

## Variáveis do servidor (nunca no código)

- `DATABASE_URL` — `mysql://usuario:senha@127.0.0.1:3306/banco` (na Hostinger, sempre 127.0.0.1).
- `GAVYO_ADMIN_KEY` — chave longa (24+ caracteres) para a Área da GAVYO.
- `UPLOAD_DIR` — pasta das fotos (padrão `~/gavyo-arquivos`, fora da pasta do app; decisão 99).

As tabelas são criadas sozinhas no primeiro acesso (`src/server/schema.ts`).

## Criar uma oficina

Pelo navegador: **`/gavyo`**, com a chave da GAVYO (decisão 98). Ou por comando:

```bash
curl -X POST https://SEU-SITE/api/gavyo/oficinas -H "content-type: application/json" -H "x-gavyo: 1" \
  -H "authorization: Bearer $GAVYO_ADMIN_KEY" \
  -d '{"workshopName":"Oficina X","ownerName":"Fulano","ownerEmail":"fulano@x.com","ownerPassword":"senha-com-8+","ownerPin":"1234"}'
```

Com `"demo": true` (e só `ownerEmail`, `ownerPassword`, `ownerPin`), cria a Oficina Modelo Passaré com os dados de exemplo.

## Testes

`TEST_DATABASE_URL=mysql://… npx vitest run tests/server.test.ts` — **apaga as tabelas** do banco de teste. Cobre: senha e bloqueio, PIN, sessão presa ao aparelho, PIN gravado só como resumo, uma oficina não lê nem mexe na outra, duas baixas simultâneas da última peça (só uma passa), troca de senha desconecta aparelhos, demonstração repetida, limpeza de sessões e tentativas, estado igual entre buscas.

Sem banco (rodam sempre): `tests/secrets.test.ts`, `tests/http.test.ts`, `tests/next-config.test.ts`, `tests/provision.test.ts`, `tests/server-store.test.ts`.

## Ligar o site no servidor

`NEXT_PUBLIC_APP_MODE=production` **na hora do build** (é lida pelo navegador). Sem ela, o site é a demonstração no navegador. A tela usa `src/app-state/store.ts`, que escolhe entre `demoStore` e `serverStore` (decisão 97).
