import { createDb, migrateDb } from './client.ts';

const { db, client } = createDb();
await migrateDb(db);
console.log('Migrações aplicadas.');
client.close();
