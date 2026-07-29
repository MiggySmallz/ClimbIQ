import type { FastifyInstance } from 'fastify';

import { loadConfig, loadNosanaConfig } from './config.js';
import { startPoller } from './poller.js';
import { startRetentionSweep } from './retention.js';
import { buildServer } from './server.js';

// Surface the Nosana job-posting config at boot so the market/node in effect is
// visible without reading .env — mirrors the poller's self-guard (loadNosanaConfig
// throws when NOSANA_* aren't set yet).
function logNosanaConfig(app: FastifyInstance): void {
  try {
    const nosana = loadNosanaConfig();
    app.log.info(
      {
        market: nosana.market,
        node: nosana.node ?? null,
        image: nosana.image,
        sampleFps: nosana.sampleFps,
        jobTimeoutS: nosana.timeoutSeconds,
      },
      nosana.node
        ? `nosana ready — market ${nosana.market}, pinned to node ${nosana.node}`
        : `nosana ready — market ${nosana.market}, market-wide node assignment`,
    );
  } catch {
    app.log.warn(
      'nosana not configured (NOSANA_API_KEY/NOSANA_MARKET/ANALYSIS_IMAGE unset) — analysis posting disabled',
    );
  }
}

const config = loadConfig();
const app = await buildServer(config);

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  logNosanaConfig(app);
  // Poll posted jobs → ingest reports (§7.2). Self-guards when Nosana isn't
  // configured yet, so it's safe to always start.
  startPoller(app);
  // Delete expired raw videos from R2 daily (§11.8, M6.1).
  startRetentionSweep(app);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
