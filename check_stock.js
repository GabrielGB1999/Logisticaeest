import { getDB } from './server/database.js';

async function main() {
  const db = await getDB();
  const item = await db.get("SELECT * FROM herramientas WHERE nombre = 'Pie Metalico'");
  console.log('Item:', item);
  const inUseRow = await db.get("SELECT COALESCE(SUM(cantidad), 0) as used FROM prestamos WHERE item_id = ? AND tipo_item = 'herramienta' AND estado = 'prestado'", [item.id]);
  console.log('En uso:', inUseRow.used);
}
main().catch(console.error);
