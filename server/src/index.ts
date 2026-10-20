import { createCeovaServer } from "./app.js";
import { runtimeConfig } from "./config.js";

const instance = createCeovaServer(runtimeConfig);
instance.server.listen(runtimeConfig.port, runtimeConfig.host, () => {
  console.log(`CEOVA signaling server listening on http://${runtimeConfig.host}:${runtimeConfig.port}`);
  if (!runtimeConfig.publicOrigin) console.warn("Session creation disabled: configure a reachable HTTPS PUBLIC_ORIGIN.");
});

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await instance.close();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
