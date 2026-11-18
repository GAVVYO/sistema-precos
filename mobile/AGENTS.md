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
  Agora `DemoRepository` (seed + MMKV, mutação sobre cópia); na Fase 2 `ApiRepository` (HTTPS + token).
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
