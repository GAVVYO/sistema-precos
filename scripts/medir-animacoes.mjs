// Mede a fluidez das animações (docs/ANIMACOES.md › Desempenho).
// Uso: npm run build && npm run start   (em outro terminal)
//      npm run medir -- --saida docs/validacao/desempenho-antes.json [--url http://localhost:3000] [--vezes 3] [--janela] [--so <cenário>] [--chrome <caminho>]
// CPU 4× mais lenta (como um computador simples de oficina). Usa o Chrome instalado: não baixa navegador.
import { writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const URL = arg("url", "http://localhost:3000");
const SAIDA = arg("saida", "desempenho.json");
const CHROME = arg("chrome", process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe");
const CPU = 4;
const so = arg("so"); // roda só um cenário (para testar uma tarefa)
const VEZES = Number(arg("vezes", "3")); // o resultado é a mediana das rodadas (a medição tem ruído)

// Gravador de quadros: intervalo entre quadros (rAF) e quadros longos (LoAF).
const GRAVADOR = () => {
  const rec = { on: false, deltas: [], loaf: 0, last: 0 };
  const loop = (t) => {
    if (rec.on && rec.last) rec.deltas.push(t - rec.last);
    rec.last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  try {
    new PerformanceObserver((l) => { if (rec.on) for (const e of l.getEntries()) rec.loaf += e.blockingDuration || 0; })
      .observe({ type: "long-animation-frame", buffered: false });
  } catch { /* navegador sem LoAF */ }
  window.__rec = {
    start() { rec.on = true; rec.deltas = []; rec.loaf = 0; rec.last = 0; },
    stop() { rec.on = false; return { deltas: rec.deltas, loaf: rec.loaf }; },
  };
};

const resumo = ({ deltas, loaf }) => {
  const s = [...deltas].sort((a, b) => a - b);
  const q = (p) => (s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1) : 0);
  return { quadros: s.length, p50ms: q(0.5), p95ms: q(0.95), perdidos: s.filter((d) => d > 33.4).length, loafMs: Math.round(loaf) };
};

// Dono da oficina de demonstração (texto que a própria tela de entrada mostra; ver src/demo/seed.ts).
async function entrar(page) {
  await page.goto(`${URL}/login`);
  await page.getByLabel("E-mail").fill("carlos@oficinamodelo.demo");
  await page.getByLabel("Senha", { exact: true }).fill("gavyo2026");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/inicio/);
  // Espera o gavião da entrada (Swoop) terminar.
  await page.waitForSelector(".swoop", { state: "detached", timeout: 15000 });
  await page.waitForTimeout(800);
}

// Dicas do tour (gavyo:prefs:tip:…) contam como vistas, menos no cenário "tour".
const SEM_DICAS = () => {
  const get = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) {
    if (String(k).startsWith("gavyo:prefs:tip:") && !sessionStorage.getItem("medir-tour")) return "true";
    return get.call(this, k);
  };
};

/** Fecha o tour de primeira vez (Esc pula), para ele não atrapalhar o cenário. */
async function semTour(page) {
  for (let i = 0; i < 6 && (await page.locator(".tour-pop").count()); i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
}

async function ir(page, nome) {
  await page.getByRole("link", { name: nome }).first().click();
  await page.waitForTimeout(900);
  await semTour(page);
}

const CENARIOS = {
  async "rolagem-servicos"(p, gravar) {
    await ir(p, "Serviços");
    await gravar(async () => {
      for (let i = 0; i < 20; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(40); }
      for (let i = 0; i < 20; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(40); }
    });
  },
  async "mover-cartao"(p, gravar) {
    await ir(p, "Serviços");
    const btn = p.locator(".order-card").getByRole("button", { name: "Começar" }).first();
    await gravar(() => btn.click());
  },
  async "abrir-servico"(p, gravar) {
    await ir(p, "Serviços");
    await gravar(async () => {
      await p.locator(".order-card .svc-open").first().click();
      await p.waitForTimeout(1200);
      await p.keyboard.press("Escape");
    });
  },
  async "trocar-aba"(p, gravar) {
    await semTour(p);
    await gravar(async () => {
      for (const n of ["Serviços", "Financeiro", "Hoje"]) {
        await p.getByRole("link", { name: n }).first().click();
        await p.waitForTimeout(700);
        await semTour(p);
      }
    });
  },
  async "numeros-contando"(p, gravar) {
    await semTour(p);
    const pay = p.locator("[data-tour=receive]").first();
    await pay.click();
    await p.locator("dialog[open]").getByText("PIX", { exact: true }).click();
    await gravar(() => p.locator("dialog[open]").getByRole("button", { name: /^Recebi/ }).click());
  },
  async "menu-lateral"(p, gravar) {
    await semTour(p);
    const trocar = async (texto) => {
      await p.locator(".topbar-account").first().click();
      await p.getByRole("menuitem", { name: texto }).click();
      await p.waitForTimeout(1100);
    };
    await gravar(async () => { await trocar("Menu na lateral"); await trocar("Menu no topo"); });
  },
  async "tv-parada"(p, gravar) {
    await p.goto(`${URL}/tv`);
    await p.waitForTimeout(1500);
    await gravar(() => p.waitForTimeout(6000), 0);
  },
  async tour(p, gravar) {
    await p.evaluate(() => {
      sessionStorage.setItem("medir-tour", "1");
      for (const k of Object.keys(localStorage)) if (k.startsWith("gavyo:prefs:tip:")) localStorage.removeItem(k);
    });
    await p.reload();
    await p.waitForSelector(".swoop", { state: "detached", timeout: 15000 });
    await p.waitForSelector(".tour-pop", { timeout: 15000 });
    await gravar(() => p.waitForTimeout(4000), 0);
  },
};

// --janela abre o Chrome de verdade (com placa de vídeo): mede melhor vidro e sombras.
const browser = await chromium.launch({ executablePath: CHROME, headless: !process.argv.includes("--janela") });
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

async function rodarUma(nome, rodar) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(GRAVADOR);
  await ctx.addInitScript(SEM_DICAS);
  const page = await ctx.newPage();
  try {
    await entrar(page);
    const cdp = await ctx.newCDPSession(page);
    let medido = null;
    const gravar = async (acao, depois = 1500) => {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
      await page.evaluate(() => window.__rec.start());
      await acao();
      await page.waitForTimeout(depois);
      medido = resumo(await page.evaluate(() => window.__rec.stop()));
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    };
    await rodar(page, gravar);
    return medido ?? { erro: "cenário não gravou" };
  } catch (e) {
    return { erro: String(e.message || e).split("\n")[0] };
  } finally {
    await ctx.close();
  }
}

const cenarios = {};
for (const [nome, rodar] of Object.entries(CENARIOS)) {
  if (so && so !== nome) continue;
  const rodadas = [];
  for (let i = 0; i < VEZES; i++) rodadas.push(await rodarUma(nome, rodar));
  const ok = rodadas.filter((r) => !r.erro);
  cenarios[nome] = ok.length
    ? Object.fromEntries(Object.keys(ok[0]).map((k) => [k, mediana(ok.map((r) => r[k]))]))
    : rodadas[0];
  if (ok.length) cenarios[nome].rodadas = ok.length;
  console.log(nome.padEnd(18), JSON.stringify(cenarios[nome]));
}
await browser.close();
writeFileSync(SAIDA, JSON.stringify({ data: new Date().toISOString(), cpu: CPU, vezes: VEZES, janela: process.argv.includes("--janela"), url: URL, cenarios }, null, 2) + "\n");
console.log(`Gravado em ${SAIDA}`);
