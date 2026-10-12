import { createDb, migrateDb } from '@pgi/db';
import { runCollection } from '@pgi/pipeline';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
const { db, client } = createDb(config.DATABASE_URL, config.DATABASE_AUTH_TOKEN);
await migrateDb(db);

const app = await buildApp({
  db,
  config,
  runCollect: async (trigger, sourceId) => {
    const result = await runCollection(db, { trigger, sourceId, log: (m) => app.log.info(m) });
    return { runId: result.runId };
  },
});

const shutdown = async (signal: string) => {
  app.log.info(`Recebido ${signal}, encerrando...`);
  await app.close();
  client.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: config.HOST, port: config.PORT });
