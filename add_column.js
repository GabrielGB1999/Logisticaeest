import { getDB } from './server/database.js';
const db = await getDB();
try {
  await db.run('ALTER TABLE prestamos ADD COLUMN nombre_manual TEXT;');
  console.log('Column added');
} catch (e) {
  console.log('Error', e.message);
}
