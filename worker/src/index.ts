import { handleRequest } from "./app";
import { remoteKeys } from "./auth";
import type { Env } from "./env";

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env, () => remoteKeys(env));
  },
} satisfies ExportedHandler<Env>;
