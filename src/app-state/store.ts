import { APP_MODE } from "@/config/env";
import { demoStore } from "@/demo/store";
import { serverStore } from "./server-store";

/**
 * De onde vêm os dados: `NEXT_PUBLIC_APP_MODE=production` usa o servidor (decisão 97);
 * sem isso, a demonstração no navegador. As telas usam só `store`.
 */
export const SERVER_MODE = APP_MODE === "production";
export const store = SERVER_MODE ? serverStore : demoStore;
