import { loadConfig } from './config.js';
import { startPoller } from './poller.js';
import { buildServer } from './server.js';

const config = loadConfig();
const app = await buildServer(config);

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  // Poll posted jobs → ingest reports (§7.2). Self-guards when Nosana isn't
  // configured yet, so it's safe to always start.
  startPoller(app);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
