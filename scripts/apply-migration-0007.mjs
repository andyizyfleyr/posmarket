import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('Adding account_type to profiles if not exists...');
  await sql`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "account_type" text DEFAULT 'buyer'`;
  console.log('Updating owners to seller...');
  await sql`UPDATE "profiles" SET "account_type" = 'seller' WHERE "id" IN (SELECT DISTINCT "user_id" FROM "stores")`;
  console.log('Updating staff to seller...');
  await sql`UPDATE "profiles" SET "account_type" = 'seller' WHERE "id" IN (SELECT DISTINCT "user_id" FROM "store_staff")`;
  console.log('Updating super admins to admin...');
  await sql`UPDATE "profiles" SET "account_type" = 'admin' WHERE "is_super_admin" = true`;
  console.log('✅ Account types migration applied successfully.');
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
