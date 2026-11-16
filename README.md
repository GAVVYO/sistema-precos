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

Nenhuma variável de ambiente é necessária para a demonstração. Veja [.env.example](.env.example).

## Roteiro de demonstração

1. Entre como **Carlos Henrique Lima (Proprietário)** na *Oficina Modelo Passaré*.
2. **Nova OS** (botão no cabeçalho): cadastre cliente e veículo, adicione peças e salve — o estoque é baixado na hora.
3. Nos detalhes da OS: altere quantidades de peças, mude o status, **registre o pagamento via PIX**, gere o **PDF** e abra o **orçamento no WhatsApp**.
4. **Ordens de serviço**: arraste cartões entre as colunas do Kanban.
5. **Financeiro**: a receita aparece após o pagamento; contas a receber listam OS concluídas e não pagas.
6. **Agenda**: arraste um atendimento para outro dia ou use o calendário do cartão para editar dia/horário. Crie agendamentos e use **Converter em OS**.
7. **Relatórios**: filtre e exporte em PDF e Excel.
8. **Configurações**: troque logotipo e cores; ajuste permissões de um funcionário.
9. Na barra amarela do topo: troque de **usuário/cargo**, troque de **oficina**, **simule queda de conexão** e **restaure a demonstração**.

A barra de navegação pode ser arrastada pela alça; solte perto do topo para encaixar novamente.

Os dados persistem entre recarregamentos (localStorage) até você restaurar a demonstração.

## Documentação

- [Acessibilidade e preferências pessoais](docs/ACESSIBILIDADE.md)

- [Ideias de interface adaptável](docs/IDEIAS-INTERFACE-ADAPTAVEL.md) — propostas, prioridades e referências; ainda não implementadas.

- [Estado atual e continuidade](docs/ESTADO-ATUAL.md) — entrega visual, agenda interativa, navegação por gesto, validações e limites.
- [Navegação por gesto](docs/NAVEGACAO.md) — arraste livre e encaixe automático no topo.
- [Revisão visual](docs/REVISAO-VISUAL.md) — referências e percursos.

- [Arquitetura](docs/ARQUITETURA.md) — camadas, pastas, multiempresa, offline.
- [Decisões técnicas](docs/DECISOES.md)
- [Funcionalidades e limitações](docs/FUNCIONALIDADES.md)
- [Roadmap: backend e produção na Hostinger](docs/ROADMAP.md)
- [Schema MySQL previsto](prisma/schema.prisma)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · Zod · dnd-kit · Recharts · jsPDF · ExcelJS · Lucide · Vitest.
Backend futuro: Route Handlers do Next.js + Prisma + MySQL (Hostinger).
