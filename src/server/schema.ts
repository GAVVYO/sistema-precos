/**
 * Tabelas do servidor (decisão 96).
 *
 * - `tenants`: uma linha por oficina, com a versão dos dados. Toda escrita trava
 *   esta linha (SELECT … FOR UPDATE): duas pessoas mexendo ao mesmo tempo na
 *   mesma oficina entram em fila, e a regra (ex.: estoque) vale para as duas.
 * - `records` (em ordem de criação, `seq`): os dados da oficina (clientes, serviços, peças…), um registro por
 *   linha, chave (oficina, tipo, id). O conteúdo é o mesmo objeto que as regras
 *   de `src/services` já usam — assim as regras são as mesmas no site e no servidor.
 * - `users`: pessoas (podem estar em mais de uma oficina); senha só como resumo scrypt.
 * - `devices`: aparelhos conectados pelo e-mail e senha do dono.
 * - `sessions`: quem está usando o aparelho agora (depois do PIN).
 * - `attempts`: tentativas erradas, para bloquear chute de senha e PIN.
 */
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS records (
    workshop_id VARCHAR(64) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    id VARCHAR(64) NOT NULL,
    seq BIGINT NOT NULL AUTO_INCREMENT,
    data LONGTEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (workshop_id, kind, id),
    UNIQUE KEY records_seq (seq)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    email VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NULL,
    data LONGTEXT NOT NULL,
    UNIQUE KEY users_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS devices (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    workshop_id VARCHAR(64) NOT NULL,
    connected_by VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY devices_ws (workshop_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    device_hash CHAR(64) NOT NULL,
    workshop_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    KEY sessions_device (device_hash)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS attempts (
    k VARCHAR(255) NOT NULL PRIMARY KEY,
    fails INT NOT NULL DEFAULT 0,
    blocked_until DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];
