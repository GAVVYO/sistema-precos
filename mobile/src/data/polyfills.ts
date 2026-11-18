import * as Crypto from "expo-crypto";

/**
 * O Hermes (motor do celular) não tem crypto.randomUUID, que as regras do site
 * usam para criar códigos (newId). Liga o gerador da Expo no lugar.
 * Precisa ser importado antes de qualquer regra do site.
 */
const g = globalThis as { crypto?: { randomUUID?: () => string } };
if (!g.crypto) g.crypto = {};
if (!g.crypto.randomUUID) g.crypto.randomUUID = () => Crypto.randomUUID();
