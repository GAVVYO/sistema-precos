/**
 * Máscaras aplicadas enquanto a pessoa digita (decisão 64). Só formatam o texto;
 * a validação continua nos serviços (normalizePhone, normalizePlate, parseBRL).
 */

/** (85) 98888-7777 ou (85) 3333-4444. Tira o +55 colado de agenda. */
export function maskPhone(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const split = d.length === 11 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

/**
 * Placa: maiúsculas, sem traço, 7 posições e só o que cabe em cada uma
 * (ABC1234 antiga ou ABC1D23 Mercosul). Letra digitada no lugar de número é ignorada.
 */
export function maskPlate(input: string): string {
  const chars = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let out = "";
  for (const c of chars) {
    const i = out.length;
    if (i >= 7) break;
    const letter = /[A-Z]/.test(c);
    if (i < 3 ? letter : i === 3 || i >= 5 ? !letter : true) out += c;
  }
  return out;
}

/**
 * Dinheiro como a pessoa pensa: "150" é R$ 150; a vírgula separa os centavos
 * (no máximo 2) e o ponto de milhar entra sozinho: "1500,5" → "1.500,5".
 */
export function maskMoney(input: string): string {
  const clean = input.replace(/[^\d,]/g, "");
  const comma = clean.indexOf(",");
  let int = (comma === -1 ? clean : clean.slice(0, comma)).replace(/^0+(?=\d)/, "");
  const dec = comma === -1 ? null : clean.slice(comma + 1).replace(/,/g, "").slice(0, 2);
  if (int === "" && dec !== null) int = "0";
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec === null ? int : `${int},${dec}`;
}

/** Só números (quilometragem, ano, quantidade), com limite de tamanho. */
export function maskDigits(input: string, max = 9): string {
  return input.replace(/\D/g, "").slice(0, max);
}

/** E-mail: sem espaços e em minúsculas. */
export function maskEmail(input: string): string {
  return input.replace(/\s/g, "").toLowerCase();
}
