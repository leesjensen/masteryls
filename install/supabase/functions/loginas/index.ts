import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createLoginAsHandler } from './handler.js';

const handler = createLoginAsHandler({
  createSupabaseClientFromAuthHeader: (authHeader: string) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    return createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
  },
  getEnv: (key: string) => Deno.env.get(key),
});

Deno.serve(handler);
