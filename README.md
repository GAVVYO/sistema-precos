# GAVYO Auto

ERP de gestão automotiva multiempresa da GAVYO para pequenas oficinas mecânicas, autoelétricas e centros automotivos.

> **Estado atual: Fase 1 — demonstração de frontend.**
> A aplicação é navegável e interativa, mas usa **dados fictícios salvos no navegador**. Não há backend, banco de dados nem autenticação real. **Não está pronta para armazenar dados reais de clientes.**

## Como executar

Requisitos: Node.js 20.9 ou superior (desenvolvido com Node 24) e npm.

```bash
npm install
```

```bash
npm run dev
```

Abra http://localhost:3000. Na tela de acesso, escolha a oficina e o usuário fictício (não há senha — é uma simulação).

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Serve o build de produção |
| `npm test` | Testes automatizados (Vitest) |
| `npm run typecheck` | Checagem de tipos (TypeScript strict) |
| `npm run lint` | ESLint |

| `npm run build:hostinger` | Gera `out/` e `gavyo-hostinger.zip` para publicar na Hostinger ([passo a passo](docs/DEPLOY-HOSTINGER.md)) |

Nenhuma variável de ambiente é necessária para a demonstração. Veja [.env.example](.env.example).

## Roteiro de demonstração

1. Entre como **Carlos Henrique Lima (Proprietário)** na *Oficina Modelo Passaré*. A primeira tela é **Hoje**, com um tour de 3 passos.
2. Em **Quem chega hoje**, clique **Chegou: abrir serviço**: o Novo serviço abre preenchido pelo agendamento.
3. Em **Quem falta pagar**, clique **Receber**: escolha a forma (o desenho muda), em Dinheiro digite quanto o cliente entregou e veja o troco; **Recebi R$ …** comemora e a linha sai da lista.
4. **Serviços**: clique **Começar** num cartão e veja ele voar até "Em andamento". Clique no cartão para o painel (lance peças com +, clique na mão de obra para digitar) e em **Ver serviço completo** (a janela nasce do cartão): PDF, WhatsApp, Mudar etapa, Cancelar.
5. **Novo serviço** (topo): tente salvar vazio para ver o que falta; preencha e salve.
6. Busca no topo: digite uma placa ou nome ("Renata").
7. **Minha conta › Menu na lateral** (ou arraste a alça ⋮⋮ do menu até a borda esquerda): a logo voa e estoura, a barra empurra a página e abre com o mouse por cima.
8. **Financeiro**, **Agenda**, **Estoque** (Entrada / Saída), **Relatórios** (PDF e Excel), **Configurações** (logo, cores, permissões).
9. Barra amarela: troque de **oficina** (a cor nova varre a tela) e de **cargo**; em **Opções da demonstração**, simule queda de conexão ou restaure os dados.

Os dados persistem entre recarregamentos (localStorage) até você restaurar a demonstração. **Minha conta › Ver as dicas de novo** reapresenta os tours.

## Documentação

Comece por aqui:
- [Guia da interface](docs/INTERFACE.md) — como cada parte da tela funciona hoje (cabeçalho, menu topo/lateral, Hoje, Serviços, Receber, tour, recursos de sistema operacional).
- [Animações](docs/ANIMACOES.md) — catálogo, arquivos e receita para criar novas.
- [Estado atual e continuidade](docs/ESTADO-ATUAL.md) — o que foi entregue e onde continuar.
- [Decisões](docs/DECISOES.md) — por que cada escolha foi feita (1–50).

Plano e validação:
- [Plano "uso sem treino"](docs/PLANO-SEM-TREINO.md) — passos 1–6, auditoria e próximos itens.
- [Validação sem treino](docs/validacao/SEM-TREINO-20261117.md) — 4 tarefas simuladas, axe e roteiro para teste com pessoa real.
- [Acessibilidade](docs/ACESSIBILIDADE.md) · [Navegação](docs/NAVEGACAO.md)

Referência:
- [Publicar na Hostinger](docs/DEPLOY-HOSTINGER.md) · [Funcionalidades e limitações](docs/FUNCIONALIDADES.md) · [Arquitetura](docs/ARQUITETURA.md) · [Roadmap: backend e produção](docs/ROADMAP.md) · [Schema MySQL previsto](prisma/schema.prisma)
- [PRODUCT.md](PRODUCT.md) e [DESIGN.md](DESIGN.md) — produto e identidade visual · [Revisão visual](docs/REVISAO-VISUAL.md) · [Contexto visual](docs/CONTEXTO-VISUAL.md) · [Ideias de interface adaptável](docs/IDEIAS-INTERFACE-ADAPTAVEL.md)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · Zod · dnd-kit · react-grid-layout · TanStack Table · Recharts · jsPDF · ExcelJS · Lucide · Vitest. Animações: View Transitions API + Web Animations, sem biblioteca extra.
Backend futuro: Route Handlers do Next.js + Prisma + MySQL (Hostinger).
