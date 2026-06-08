import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createGithubGradeHandler } from './handler.js';

const handler = createGithubGradeHandler({
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
  fetchFn: fetch,
});

Deno.serve(handler);
