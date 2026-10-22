// orderStore.ts — Fase 2: persistencia de órdenes en Vercel Postgres/Neon.
// Si DATABASE_URL no está definida o la DB falla, queda el fallback anterior
// en memoria (console.warn una vez): los pagos siguen operando pero NO
// sobreviven a cold starts ni a los varios lambdas de Vercel (cada lambda
// tiene su propio mapa). Schema: tabla orders con columna usos (contador
// atómico, Fase 3).
import { Pool } from "pg";

export interface Order {
  orderId: string;
  preferenceId: string;
  status: 'pending' | 'approved' | 'failed';
  amount: number;
  title: string;
  payerEmail?: string;
  mpPaymentId?: string;
  paidAt?: number;
  createdAt: number;
  usos?: number;
}

// Fallback en memoria (comportamiento idéntico a la versión anterior).
const ordersMap = new Map<string, Order>();
let warnedNoDb = false;
let warnedDbError = false;
function warnOnce(scope: 'no-db' | 'db-error', msg: string): void {
  if (scope === 'no-db') { if (!warnedNoDb) { console.warn(`[orderStore] ${msg}`); warnedNoDb = true; } return; }
  if (!warnedDbError) { console.error(`[orderStore] ${msg}`); warnedDbError = true; }
}

let pool: Pool | null = null;
function dbPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) { warnOnce('no-db', "DATABASE_URL no definida: órdenes SOLO en memoria (se pierden en cold start). Configura Vercel Postgres/Neon."); return null; }
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 });
  }
  return pool;
}

let schemaPromise: Promise<void> | null = null;
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS orders (
  order_id       TEXT PRIMARY KEY,
  preference_id  TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  amount         NUMERIC(12,0) NOT NULL,
  title          TEXT,
  payer_email    TEXT,
  mp_payment_id  TEXT,
  paid_at        BIGINT,
  created_at     BIGINT NOT NULL,
  usos           INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_pref_idx ON orders (preference_id);
`;

function ensureSchema(p: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = p
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((e) => { schemaPromise = null; throw e; });
  }
  return schemaPromise;
}

interface OrderRow {
  order_id: string;
  preference_id: string | null;
  status: string;
  amount: string | number;
  title: string | null;
  payer_email: string | null;
  mp_payment_id: string | null;
  paid_at: string | number | null;
  created_at: string | number;
  usos: string | number;
}

function rowToOrder(r: OrderRow): Order {
  return {
    orderId: r.order_id,
    preferenceId: r.preference_id || "",
    status: (r.status as Order['status']) || 'pending',
    amount: Number(r.amount),
    title: r.title || "",
    payerEmail: r.payer_email || undefined,
    mpPaymentId: r.mp_payment_id || undefined,
    paidAt: r.paid_at != null ? Number(r.paid_at) : undefined,
    createdAt: Number(r.created_at),
    usos: Number(r.usos ?? 0),
  };
}

export async function saveOrder(order: Order): Promise<void> {
  const p = dbPool();
  if (p) {
    try {
      await ensureSchema(p);
      await p.query(
        `INSERT INTO orders (order_id, preference_id, status, amount, title, payer_email, paid_at, created_at, usos)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (order_id) DO UPDATE SET
           preference_id = EXCLUDED.preference_id,
           status = EXCLUDED.status,
           amount = EXCLUDED.amount,
           title = EXCLUDED.title,
           payer_email = EXCLUDED.payer_email,
           created_at = EXCLUDED.created_at`,
        [order.orderId, order.preferenceId, order.status, order.amount, order.title, order.payerEmail || null, order.paidAt ?? null, order.createdAt, order.usos ?? 0]
      );
      // Espejo en memoria también en modo DB (resiliencia si la DB cae después).
      ordersMap.set(order.orderId, order);
      if (order.preferenceId) ordersMap.set(`pref:${order.preferenceId}`, order);
      return;
    } catch (e: any) {
      warnOnce('db-error', `No se pudo guardar en DB (${String(e?.message || e).slice(0, 200)}). Usando memoria.`);
    }
  }
  ordersMap.set(order.orderId, order);
  if (order.preferenceId) {
    ordersMap.set(`pref:${order.preferenceId}`, order);
  }
}

export async function getOrderByOrderId(orderId: string): Promise<Order | undefined> {
  const p = dbPool();
  if (p) {
    try {
      await ensureSchema(p);
      const r = await p.query<OrderRow>(`SELECT * FROM orders WHERE order_id = $1`, [orderId]);
      if (r.rows[0]) return rowToOrder(r.rows[0]);
      // No está en DB: puede que una escritura previa cayera al espejo.
      return ordersMap.get(orderId);
    } catch (e: any) {
      warnOnce('db-error', `Lectura DB falló (${String(e?.message || e).slice(0, 200)}). Usando memoria.`);
    }
  }
  return ordersMap.get(orderId);
}

export async function getOrderByPreferenceId(preferenceId: string): Promise<Order | undefined> {
  const p = dbPool();
  if (p) {
    try {
      await ensureSchema(p);
      const r = await p.query<OrderRow>(`SELECT * FROM orders WHERE preference_id = $1`, [preferenceId]);
      if (r.rows[0]) return rowToOrder(r.rows[0]);
      return ordersMap.get(`pref:${preferenceId}`);
    } catch (e: any) {
      warnOnce('db-error', `Lectura DB falló (${String(e?.message || e).slice(0, 200)}). Usando memoria.`);
    }
  }
  return ordersMap.get(`pref:${preferenceId}`);
}

export async function updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | undefined> {
  const p = dbPool();
  if (p) {
    try {
      await ensureSchema(p);
      // CONCAT de asignaciones dinámico seguro (solo claves conocidas).
      const allowed: Array<keyof Order> = ['status', 'mpPaymentId', 'paidAt', 'payerEmail', 'preferenceId', 'title', 'amount'];
      const sets: string[] = [];
      const vals: any[] = [];
      const colMap: Partial<Record<keyof Order, string>> = {
        status: 'status', mpPaymentId: 'mp_payment_id', paidAt: 'paid_at',
        payerEmail: 'payer_email', preferenceId: 'preference_id', title: 'title', amount: 'amount',
      };
      for (const k of allowed) {
        if (updates[k] !== undefined && colMap[k as keyof Order]) {
          vals.push(updates[k]);
          sets.push(`${colMap[k] as string} = $${vals.length}`);
        }
      }
      if (!sets.length) return await getOrderByOrderId(orderId);
      vals.push(orderId);
      const r = await p.query<OrderRow>(
        `UPDATE orders SET ${sets.join(', ')} WHERE order_id = $${vals.length} RETURNING *`,
        vals
      );
      if (r.rows[0]) return rowToOrder(r.rows[0]);
      return await getOrderByOrderId(orderId);
    } catch (e: any) {
      warnOnce('db-error', `Update DB falló (${String(e?.message || e).slice(0, 200)}). Usando memoria.`);
    }
  }
  // Fallback memoria
  const existing = ordersMap.get(orderId);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates };
  ordersMap.set(orderId, updated);
  if (updated.preferenceId) {
    ordersMap.set(`pref:${updated.preferenceId}`, updated);
  }
  return updated;
}

// Fase 3 usará consumeUseAtomic (UPDATE ... SET usos = usos + 1 WHERE usos < 3).
export async function consumeUseAtomic(orderId: string): Promise<{ ok: boolean; usos: number }> {
  const p = dbPool();
  if (!p) return { ok: false, usos: 0 };
  const r = await p.query<{ usos: string | number }>(
    `UPDATE orders SET usos = usos + 1 WHERE order_id = $1 AND status = 'approved' AND usos < 3 RETURNING usos`,
    [orderId]
  );
  if (!r.rows[0]) return { ok: false, usos: 0 };
  return { ok: true, usos: Number(r.rows[0].usos) };
}
