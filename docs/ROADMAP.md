# Roadmap — backend e produção na Hostinger

## Fase 2 — Backend real

1. **Prisma + MySQL**
   - `npm install prisma @prisma/client`; usar [prisma/schema.prisma](../prisma/schema.prisma) como ponto de partida.
   - Banco InnoDB, charset `utf8mb4`. Migrations versionadas (`prisma migrate dev` em desenvolvimento, `prisma migrate deploy` em produção).
   - Adicionar na migration o que o Prisma não expressa: `CHECK (quantity >= 0)` em `Part`.
2. **Autenticação por sessão**
   - Senhas com Argon2id (ou bcrypt), nunca em texto puro nem no navegador.
   - Sessão no servidor (tabela `Session`), cookie `httpOnly`, `Secure`, `SameSite=Lax`, com expiração e renovação.
   - Limite de tentativas de login; contas criadas pela GAVYO (sem cadastro público).
3. **Contexto e autorização no servidor**
   - Um único helper monta `ctx = { workshopId, userId }` a partir da sessão e da `WorkshopMembership` ativa. Nunca aceitar `workshopId` do navegador.
   - Todas as leituras passam por um repositório que exige `workshopId`; todas as escritas chamam `assertCan`.
4. **APIs (Route Handlers)**
   - Um handler por operação de `src/services`, reaproveitando os schemas Zod.
   - Substituir `demoStore.mutate` por chamadas HTTP no `act()` e `scopeTo` por carregamento de dados; as telas não mudam.
5. **Transações e concorrência**
   - `prisma.$transaction` em criação/edição de OS, movimentações e pagamentos.
   - `SELECT ... FOR UPDATE` na peça ao movimentar estoque; incremento de `Workshop.nextOrderNumber` na mesma transação.
   - Idempotência: chave de operação enviada pelo cliente (`StockMovement.operationKey`), `Payment.orderId` único, `FinancialTransaction.paymentId` único.
6. **Testes**
   - Portar `tests/services.test.ts` para rodar contra MySQL de teste, incluindo os testes de isolamento entre oficinas e de concorrência (duas baixas simultâneas).
7. **Provisionamento**
   - Script/tela interna da GAVYO para criar oficina, configurações e o primeiro proprietário.

## Fase 3 — Implantação na Hostinger

Verificar **antes** de contratar/implantar:

- [ ] O plano suporta aplicações **Node.js / Next.js** (hospedagem Node gerenciada ou VPS). Hospedagem compartilhada apenas PHP **não serve**.
- [ ] Versão do Node disponível (≥ 20.9) e do MySQL (≥ 8.0 recomendado, por `CHECK` e desempenho).
- [ ] Limites de conexões simultâneas do MySQL — ajustar `connection_limit` na `DATABASE_URL`.
- [ ] O MySQL é acessível pelo host informado no painel (normalmente `localhost` no mesmo plano).

Passos:

1. Criar banco e usuário no painel da Hostinger; anotar host, porta, banco, usuário e senha.
2. Configurar variáveis de ambiente no painel: `NEXT_PUBLIC_APP_MODE=production`, `DATABASE_URL`, `SESSION_SECRET`.
3. Conectar o repositório GitHub (deploy automático) ou enviar o build; comando de build `npm run build`, de início `npm run start`.
4. Rodar `prisma migrate deploy` como etapa de deploy — nunca `migrate dev` em produção. Fazer backup antes de cada migration.
5. Ativar HTTPS (certificado no painel) e redirecionar HTTP → HTTPS.
6. Backups automáticos do banco (painel + dump agendado para fora do servidor) e **testar uma restauração completa**.
7. Monitoramento: registro de erros do servidor, alerta de indisponibilidade e de uso de disco/banco.
8. Offline de leitura: Service Worker + IndexedDB, cache por oficina e usuário, limpo no logout.

A aplicação só deve receber clientes reais depois de autenticação, autorização no servidor, isolamento testado, backups e restauração verificados.

## Fase 4 — Validação comercial

Apresentar a demonstração a oficinas do Passaré, observar o uso real (principalmente o tempo para abrir uma OS), registrar dificuldades e ajustar os módulos antes de ampliar o escopo.
