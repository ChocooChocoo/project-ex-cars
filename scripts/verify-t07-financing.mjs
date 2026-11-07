import pg from "pg";

import dns from "node:dns";

const lookup = dns.lookup;
const host = process.env.SUPABASE_DB_HOST || "db.nsdwyxwrsmtarrxgzeuj.supabase.co";
const ip = (process.env.SUPABASE_POOLER_IPS || "54.255.219.82").split(",")[0].trim();
dns.lookup = (hostname, options, callback) => {
  if (hostname !== host) return lookup(hostname, options, callback);
  const cb = typeof options === "function" ? options : callback;
  cb(null, ip, 4);
};

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const { rows } = await client.query(`
      SELECT 'submitted_by' AS check_name, EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payment_records' AND column_name = 'submitted_by'
      ) AS present
      UNION ALL
      SELECT 'installment_approved_by', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payment_records' AND column_name = 'approved_by'
      )
      UNION ALL
      SELECT 'installment_approved_at', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payment_records' AND column_name = 'approved_at'
      )
      UNION ALL
      SELECT 'installment_kind', EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.payment_records'::regclass AND conname = 'payment_records_payment_kind_check'
          AND pg_get_constraintdef(oid) LIKE '%installment%'
      )
      UNION ALL
      SELECT 'sold_trigger', EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.vehicles'::regclass
          AND tgname = 'guard_financing_sold' AND NOT tgisinternal AND tgenabled = 'O'
      )
      UNION ALL
      SELECT 'review_index', to_regclass('public.idx_payment_records_installment_review') IS NOT NULL
      UNION ALL
      SELECT 'live_installment_unique_index', to_regclass('public.idx_payment_records_live_installment') IS NOT NULL;
    `);
    console.table(rows);
    const duplicates = await client.query(`
      SELECT count(*)::int AS duplicate_live_installment_groups FROM (
        SELECT transaction_id, installment_id FROM public.payment_records
        WHERE installment_id IS NOT NULL AND rejected_at IS NULL
        GROUP BY transaction_id, installment_id HAVING count(*) > 1
      ) duplicates;
    `);
    console.table(duplicates.rows);
    const definition = await client.query(`
      SELECT pg_get_triggerdef(oid) AS trigger_definition FROM pg_trigger
      WHERE tgrelid = 'public.vehicles'::regclass AND tgname = 'guard_financing_sold' AND NOT tgisinternal;
    `);
    for (const row of definition.rows) console.log(row.trigger_definition);
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
