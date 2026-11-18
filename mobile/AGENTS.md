# Regras do app mobile GAVYO Auto

Regras para quem escreve código em `mobile/` (pessoa ou agente). Fontes: skills oficiais da Expo
(expo-overview, expo-project-structure, expo-design-system, expo-router, expo-ui, expo-native-ui,
expo-animation), appllama-app-design, Impeccable, ui-ux-pro-max e as decisões do projeto
(`../docs/DECISOES.md` 45–66, `../docs/APP-MOBILE.md`). Em conflito, vale: decisão do dono > este arquivo > skill.

## 1. Produto
- Público: **recepção e mecânico** sem costume com sistemas. Sucesso = usar sem treino.
- Português do balcão (glossário em `APP-MOBILE.md` §3): Serviço, Aguardando / Em andamento / Pronto,
  Começar, Marcar como pronto, Receber, Carro, Placa, Pessoas. **Um rótulo por intenção** (nada de
  "Salvar" num lugar e "Confirmar" em outro para a mesma ação).
- **Um botão principal por tela/cartão.** O resto vai em "Mais" ou fica menor.

## 2. Regras de negócio
- **Nunca reescrever regra.** Importar de `@core/*` (= `../src/*`): `domain`, `services`, `lib/format`,
  `lib/masks`, `lib/whatsapp`, `demo/seed`. Se algo compartilhado depender do navegador, parar e avisar.
- Telas nunca tocam no armazenamento: tudo passa pelo **Repository** (`src/data/`).
  Agora `DemoRepository` (seed + AsyncStorage — roda no Expo Go; MMKV não —, mutação sobre cópia); na Fase 2 `ApiRepository` (HTTPS + token).
- O app **nunca** acessa banco de dados direto nem guarda credencial de banco.
- Permissões: as mesmas do site (`can(...)` sobre a membership); mecânico **lança peças**, não vê dinheiro.

## 3. Estrutura (expo-project-structure)
```
mobile/
  src/app/          rotas Expo Router — SÓ rotas (cada arquivo vira tela)
  src/screens/      corpo das telas (componentes só daquela tela ficam junto)
  src/components/   UI reutilizável, um export por arquivo, nomes em kebab-case
  src/data/         Repository, store da demo, hooks de dados
  src/theme/        tokens (cores, espaço, tipo, raio, sombra, movimento)
  src/hooks/  src/utils/
```
- Arquivos em **kebab-case**; alias `@/` para `mobile/src` e `@core/` para `../src`.
- Sempre `_layout.tsx` para pilhas e abas; nunca componentes ou utilitários dentro de `src/app/`.

## 4. Navegação (expo-router + appllama)
- Abas (recepção): **Hoje · Serviços · Pessoas · Conta**. Mecânico: **Seus carros · Conta**.
- Abas são pares: cada uma guarda a própria pilha; sem animação de deslizar entre abas.
- `push` para descer (lista → ficha); `replace` para seguir (entrar → início). Entrar é porta de mão única:
  sem "voltar" para a tela de entrada.
- Tarefa com passos (Novo serviço, Receber, Novo cliente) abre como **modal/folha**, com Fechar sempre visível.
- Voltar só é bloqueado durante gravação; nunca prender a pessoa.

## 5. Visual: "mistura" (decisão 66)
- **Estrutura nativa** (barra de abas, cabeçalho, voltar, folhas) + **componentes GAVYO**:
  placa desenhada, cartão de carro, abas de etapa estilo iPhone, crachá, carimbo, pílulas.
- **Tokens únicos** em `src/theme/`: nenhum hex, tamanho de fonte ou espaçamento solto fora dele
  (valor repetido duas vezes vira token).
- **Cores**: a cor principal da oficina é o único destaque (botões e seleção). Cores de etapa **fixas**:
  Aguardando `#b45309`, Em andamento `#2563eb`, Pronto `#15803d`. **Uma família de cinzas** (frios).
  Cor nunca sozinha: sempre com texto.
- **Formas**: ações e etiquetas em **pílula**; cartões **20**; folhas e campos **14**. Sombra leve com
  deslocamento (nada de brilho colorido sem deslocamento).
- **Ícones**: só **Phosphor duotone** (`phosphor-react-native`). Nunca emoji como ícone.
- **Tipografia**: corpo 16, apoio 14 (mínimo 13), títulos 20/24/28. Respeitar a fonte grande do sistema.
- **Proibido** (Impeccable + native-slop): gradiente roxo/brilho em botão, rótulo pequeno acima de título,
  cartão dentro de cartão, borda colorida grossa na lateral, tudo virar cartão, texto cinza sobre cinza,
  modal "de site" no lugar de folha nativa.

## 6. Componentes
- Antes de criar controle (folha, menu, seletor, switch, grupo de formulário), **checar `@expo/ui`**.
  Listas longas: `FlatList`/`FlashList` (o `List` do @expo/ui não é virtualizado).
- Componentes recebem `variant`/`size`/`state` por props; telas montam componentes, não estilos.
- Formulários: rótulo visível sempre; uma pergunta por vez quando passar de 4 campos; opcionais em
  "Mais detalhes"; máscaras de `@core/lib/masks` ("150" = R$ 150); erro escrito embaixo do campo.

## 7. Movimento (expo-animation)
- Animação só quando explica o que mudou: carro que muda de etapa, linha que vai para a aba, carimbo.
- Reanimated na thread de UI; curtas (200–400 ms); molas para gesto, `timing` para mudança de estado.
- **Vibração** (expo-haptics) em: mudança de etapa, recebimento, carimbo. Nada de vibrar à toa.
- "Reduzir movimento" do sistema desliga animações (o resultado aparece direto).

## 8. Acessibilidade e toque
- Alvo mínimo **48 dp**; 8 dp entre alvos.
- Todo botão de ícone tem `accessibilityLabel`; papéis (`accessibilityRole`) corretos; ordem de leitura lógica.
- Contraste 4,5:1 (texto) e 3:1 (texto grande/ícones).
- Toda tela tem os **estados completos**: carregando, vazio (com o próximo passo), erro (com o que fazer),
  sem internet (botões que gravam desativados, como no site).

## 9. Ferramentas e verificação
- Comandos Expo pelo agent CLI: `npx --yes @expo/agent-cli@latest <comando>`; instalar pacotes com
  `... install <pacote>` (versões compatíveis com o SDK). Consultar a doc **da versão do SDK**, não "latest".
- Antes de cada entrega: `tsc --noEmit`, lint, `npm test` na raiz (o site continua passando), rodar a
  versão web do Expo e tirar capturas em 360 e 412 dp de largura; o dono confere no celular pelo **Expo Go**.
- Um commit por etapa, mensagem em português; mostrar o resultado antes da próxima etapa.
  Decisão visual nova = perguntar antes.

---

# Notas da Expo (modelo do SDK 58)

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx @expo/agent-cli install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx @expo/agent-cli start              # start the dev server
npx @expo/agent-cli lint               # lint
npx tsc --noEmit            # typecheck
npx @expo/agent-cli doctor             # diagnose dependency and config issues
npx @expo/agent-cli install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx @expo/agent-cli run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

<!-- BEGIN EXPO AGENT CLI MANAGED BLOCK -->
<!-- Generated by `npx @expo/agent-cli agents:setup`. Everything inside the markers is overwritten on the next run. -->

## Expo project

- Project: gavyo-app
- SDK: 58.0.26
- Native: CNG (no native directories; they are generated by `npx expo prebuild`)
- Expo Go: compatible (Expo Go can run this project)
- Dev client: `expo-dev-client` is not installed

## Commands

For the operations listed below, use `@expo/agent-cli` in place of the equivalent commands elsewhere in this file or in loaded skills. Package installation still uses Expo’s SDK-compatible version resolution. Use `bunx` instead of `npx` when `bun.lock` is present.

Most commands take `--json` for a machine-readable report.

New to this CLI? Run `npx @expo/agent-cli help workflow`: the commands in order, the exit codes, and the `--json` contract.

- `npx @expo/agent-cli status` — where the project is right now, and what would happen next: which sources changed since the last build, whether an update can ship over the air, and whether EAS already has a build for this fingerprint
- `npx @expo/agent-cli status --json` — the same report as one object, with the raw project probe under `probe`
- `npx @expo/agent-cli status --assert js-only` — a gate on what a change costs: exit 20 when it costs more than the class named, 22 when nothing could be measured, 0 otherwise
- `npx @expo/agent-cli dev --android` — get the app onto that platform's device: it prints the plan, then runs it. The platform flag (--ios, --android, --web) is required; add --plan to print the steps without running them
- `npx @expo/agent-cli start` — `expo start` and nothing else: a dev server no planning may touch
- `npx @expo/agent-cli install <pkg>` — install a package and report what it changes natively
- `npx @expo/agent-cli install --fix` — fix incompatible package versions using Expo's SDK-compatible version resolution
- `npx @expo/agent-cli lint` — run the project's Expo lint command
- `npx @expo/agent-cli doctor` — diagnose dependency and configuration issues with expo-doctor
- `npx @expo/agent-cli typecheck` — run the TypeScript compiler of this project as a gate: exit 20 with the diagnostics, exit 0 when there are none. A bundle that builds and an app that does not throw do not cover this.
- `npx @expo/agent-cli runtime:eval <js>` — evaluate JavaScript in the running app
- `npx @expo/agent-cli runtime:errors` — collect the runtime errors of the running app
- `npx @expo/agent-cli navigate <route>` — open a route as a deep link on a device
- `npx @expo/agent-cli runtime:tree` — what is on the screen of the running app, by testID
- `npx @expo/agent-cli runtime:tap <testID>` — tap an element; `--verify` reports what changed
- `npx @expo/agent-cli runtime:type <text> --testID <id>` — type into an input
- `npx @expo/agent-cli skills:list` — the agent skills the installed packages ship
- `npx @expo/agent-cli new <dir>` / `npx @expo/agent-cli deploy` — create a project headlessly / deploy web and native
- `npx @expo/agent-cli smoke --android` — the whole gate in one command: the dev server bundles, the app is up, and nothing threw

## Expo docs

The full Expo docs for this project’s SDK can be local Markdown files.
- `npx @expo/agent-cli docs:sync` downloads them and prints two directories: all docs, and this SDK’s API reference. Grep those directories.
- `npx @expo/agent-cli docs:search <query>` returns ranked pages with file paths and line numbers.
Links in the docs point to `https://docs.expo.dev/<path>.md`. To read one locally, open `<path>.md` in the docs directory that `docs:sync` printed.
Prefer the local docs over web fetches of docs.expo.dev.

## Devices

Run `npx @expo/agent-cli dev` before `navigate`, `runtime:reload` or `runtime:stop`, or they refuse with `NO_BOUND_DEVICE` and name the command. Never boot, shut down or delete a simulator named `agent-cli …` yourself, and never kill an emulator instance started with `-read-only`; it may be bound to another worktree.

## Expo skills

For Expo or EAS work, start with the `expo-overview` skill when it is available in your agent’s skill list. It routes your goal to the relevant Expo or EAS skill. Then read any matching package skills listed below for guidance specific to the installed packages.

<!-- BEGIN EXPO PACKAGE SKILLS -->
## Package skills

No linked package skills are available.

Run `npx @expo/agent-cli skills:sync` after changing dependencies to refresh this index. Run `npx @expo/agent-cli skills:list` to see available package skills.
<!-- END EXPO PACKAGE SKILLS -->

Commands end with a `Suggested next:` section — suggested follow-up commands, not required steps. Run one only when it serves your current goal.
<!-- END EXPO AGENT CLI MANAGED BLOCK -->
