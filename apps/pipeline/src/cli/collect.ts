import { createDb, migrateDb, seed } from '@pgi/db';
import { runCollection } from '../collect.ts';

/** Coleta agendada (GitHub Actions ou cron). Sai com código 1 apenas se todas as fontes falharem. */
const { db, client } = createDb();
await migrateDb(db);
await seed(db); // garante categorias e fontes padrão em bancos novos
const sourceArg = process.argv.find((a) => a.startsWith('--source='));
const result = await runCollection(db, {
  trigger: process.env.GITHUB_ACTIONS ? 'github-actions' : 'cli',
  sourceId: sourceArg ? Number(sourceArg.split('=')[1]) : undefined,
  log: (m) => console.log(m),
});
console.log(`Execução #${result.runId}: ${result.status}`, result.stats);
client.close();
if (result.status === 'failed') process.exit(1);
