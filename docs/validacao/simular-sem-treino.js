// Passo 6: simula uma pessoa sem experiência nas 4 tarefas, só clicando no que está ESCRITO na tela.
// Conta cliques/teclas, registra o texto que ela precisa ler e roda o axe em cada tela.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || './';
// Requer axe-core instalado à parte (npm i axe-core) e o app em http://localhost:3017.
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const VP = { '1366': { width: 1366, height: 768 }, '390': { width: 390, height: 844 } }[process.argv[2] || '1366'];
const TAG = 'v' + (process.argv[2] || '1366');
const ROLE = process.argv[3] || 'Proprietário';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: VP });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const log = []; let clicks = 0, keys = 0, task = '';
  const step = (s) => log.push(`  [${task}] ${s}`);
  const click = async (loc, what) => { await loc.click(); clicks++; step(`clica “${what}”`); await p.waitForTimeout(350); };
  const type = async (loc, text, what) => { await loc.fill(text); keys++; step(`digita “${text}” em ${what}`); await p.waitForTimeout(150); };
  const axe = async (name) => {
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200);
    await p.addScriptTag({ content: AXE });
    const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })).violations.map((v) => `${v.impact} ${v.id} (${v.nodes.length}): ${v.help} → ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
    log.push(`  axe ${name}: ${r.length ? '\n    ' + r.join('\n    ') : 'sem violações'}`);
  };
  const done = (ok, note = '') => { log.push(`= ${task}: ${ok ? 'CONCLUÍDA' : 'FALHOU'} em ${clicks} cliques + ${keys} campos ${note}`); clicks = 0; keys = 0; };

  await p.goto('http://localhost:3017/login'); await p.waitForSelector('select');
  await p.locator('label', { hasText: ROLE }).first().click();
  await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForURL(/inicio/);
  // Primeira vez: ela lê o tour e clica até o fim.
  task = 'tour'; await p.waitForSelector('.tour-pop', { timeout: 4000 }).catch(() => {});
  while (await p.locator('.tour-pop').count()) { await click(p.locator('.tour-pop button:has-text("Próximo"), .tour-pop button:has-text("Entendi")').last(), 'Próximo/Entendi'); await p.waitForTimeout(500); }
  done(true, '(tour da tela Hoje)');
  await axe('Hoje');

  // 1) Abrir serviço: chegou um carro sem agendamento.
  task = '1 abrir serviço';
  await click(p.getByRole('button', { name: 'Novo serviço' }).first(), 'Novo serviço');
  const dlg = p.locator('dialog[open]');
  await click(dlg.getByRole('button', { name: 'Abrir serviço', exact: true }), 'Abrir serviço (sem preencher)');
  const err1 = await p.locator('.toast, [role=status], [role=alert]').allInnerTexts().catch(() => []);
  step(`mensagem ao tentar sem preencher: ${JSON.stringify(err1.filter(Boolean).slice(-2))}`);
  await p.screenshot({ path: OUT + TAG + '-1-erro.png' });
  await type(dlg.getByLabel('Nome'), 'João Batista Lima', 'Nome');
  await type(dlg.getByLabel('Telefone'), '85988887777', 'Telefone');
  await type(dlg.getByLabel('Placa'), 'JBL2C34', 'Placa');
  await type(dlg.getByLabel('Marca'), 'Fiat', 'Marca');
  await type(dlg.getByLabel('Modelo'), 'Strada', 'Modelo');
  await type(dlg.getByLabel('O que o cliente pediu'), 'Barulho na suspensão', 'Descrição');
  await p.screenshot({ path: OUT + TAG + '-1-form.png' });
  await click(dlg.getByRole('button', { name: 'Abrir serviço', exact: true }), 'Abrir serviço');
  const opened = await p.getByText(/aberto com sucesso/).count();
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  done(opened > 0);

  // 2) Mudar etapa: o mecânico começou a mexer no carro do João.
  task = '2 mudar etapa';
  await click(p.getByRole('link', { name: 'Serviços' }).first(), 'Serviços');
  await p.waitForTimeout(800);
  while (await p.locator('.tour-pop').count()) { await click(p.locator('.tour-pop button:has-text("Próximo"), .tour-pop button:has-text("Entendi")').last(), 'Próximo/Entendi'); await p.waitForTimeout(500); }
  const card = p.locator('.order-card', { hasText: 'João Batista Lima' });
  await click(card.getByRole('button', { name: 'Começar' }), 'Começar');
  await p.screenshot({ path: OUT + TAG + '-2-comecou.png' });
  const moved = await p.locator('[aria-label^="Em andamento"] .order-card', { hasText: 'João Batista Lima' }).count();
  done(moved > 0, '(cartão foi para Em andamento)');
  await axe('Serviços');

  // 3) Receber: um carro pronto, cliente veio buscar.
  task = '3 receber';
  await click(p.getByRole('link', { name: 'Hoje' }).first(), 'Hoje');
  await p.waitForTimeout(600);
  const pay = p.locator('[data-tour=receive]').first();
  if (!(await pay.count())) { step('sem botão Receber: ' + (await p.locator('.today-hint').first().innerText().catch(() => '—'))); done(false, '(cargo sem permissão de receber)'); }
  else {
  const who = await pay.locator('xpath=ancestor::li').locator('.today-name-link, strong').first().innerText();
  await click(pay, `Receber (${who})`);
  await click(p.locator('dialog[open]').getByRole('button', { name: /PIX/ }).first(), 'PIX');
  await p.screenshot({ path: OUT + TAG + '-3-receber.png' });
  await click(p.locator('dialog[open]').getByRole('button', { name: /^Recebi/ }), 'Recebi R$ …');
  const received = await p.getByText(/^Recebido R\$/).count();
  done(received > 0);
  }

  // 4) Achar cliente: “a Renata ligou perguntando do carro dela”.
  task = '4 achar cliente';
  const search = p.getByRole('combobox', { name: 'Buscar placa ou nome do cliente' }).or(p.getByLabel('Buscar placa ou nome do cliente')).first();
  await click(search, 'campo de busca');
  await type(search, 'Renata', 'busca');
  await p.screenshot({ path: OUT + TAG + '-4-busca.png' });
  const found = await p.locator('.order-search-results').getByText('Renata Cavalcante Dias').count();
  step(`resultados mostram a Renata: ${found}`);
  await click(p.locator('.order-search-results .search-result-main').first(), 'resultado da Renata');
  const status = await p.locator('dialog[open]').innerText().then((t) => t.split('\n').slice(0, 4).join(' / ')).catch(() => '');
  step(`vê: ${status}`);
  await p.screenshot({ path: OUT + TAG + '-4-achou.png' });
  done(found > 0 && status.includes('Serviço nº'));
  await axe('Detalhes do serviço');

  console.log(`## ${ROLE} ${VP.width}px\n` + log.join('\n') + (errs.length ? '\nERROS: ' + errs.join(' | ') : '\nsem erros no console'));
  await b.close();
})();
