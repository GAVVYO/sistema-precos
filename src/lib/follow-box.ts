/**
 * Acompanha a posição de um elemento na tela (usado pelo recorte do tour).
 * Mede na hora e depois só quando algo pode ter mudado — rolagem (de qualquer
 * área), redimensionamento da janela, da página ou do próprio alvo —, no máximo 1× por
 * quadro. Antes era um laço que media a cada quadro, mesmo com tudo parado.
 * Devolve a função que desliga tudo.
 */
export function followBox(el: Element, onChange: (r: DOMRect) => void): () => void {
  let frame = 0;
  const measure = () => {
    frame = 0;
    onChange(el.getBoundingClientRect());
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(measure);
  };
  measure();
  const opts = { capture: true, passive: true } as const;
  window.addEventListener("scroll", schedule, opts);
  window.addEventListener("resize", schedule);
  const ro = new ResizeObserver(schedule);
  ro.observe(el);
  // A página também: conteúdo acima do alvo que cresce (dados chegando, painel abrindo) empurra o alvo sem rolagem.
  ro.observe(document.documentElement);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    window.removeEventListener("scroll", schedule, opts);
    window.removeEventListener("resize", schedule);
    ro.disconnect();
  };
}
