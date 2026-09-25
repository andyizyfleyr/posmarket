import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createHash, randomBytes } from 'crypto';

const sql = neon(process.env.DATABASE_URL);
const email = 'andyecompro@gmail.com';
await sql(`DELETE FROM verification_tokens WHERE identifier=$1;`, [email]);
console.log(randomBytes(16).toString('hex'));