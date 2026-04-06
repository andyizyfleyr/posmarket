import { createBrowserClient } from '@supabase/ssr';
import { supabaseFetchWithTimeout } from './utils/supabase/retry'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    global: {
        fetch: supabaseFetchWithTimeout(20000),
        headers: {
            'Connection': 'close'
        }
    }
})

