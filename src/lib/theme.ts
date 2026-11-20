/** Escolhe a combinação preto/branco de maior contraste para a cor da oficina. */
export function contrastOn(hex: string): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b > .179 ? "#000000" : "#ffffff";
}

/** Conserva o matiz da oficina, escurecendo cores claras para texto e links. */
export function readableAccent(hex: string, minimum = 5.5): string {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  const rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const luminance = (values: number[]) => values.map(c => {
    const s = c / 255;
    return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
  }).reduce((sum, c, index) => sum + c * [.2126, .7152, .0722][index], 0);
  while (1.05 / (luminance(rgb) + .05) < minimum) {
    for (let index = 0; index < 3; index++) rgb[index] = Math.floor(rgb[index] * .96);
  }
  return `#${rgb.map(c => c.toString(16).padStart(2, "0")).join("")}`;
}
