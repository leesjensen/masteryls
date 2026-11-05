import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createTelemetryFlushHandler } from './handler.js';

// Service-role client: reads the aggregate metric rows (RLS-protected) to export them.
const supabase = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');

const handler = createTelemetryFlushHandler({
  getEnv: (key: string) => Deno.env.get(key),
  fetchFn: fetch,
  readMetrics: async () => {
    const { data, error } = await supabase.from('client_metric').select('metric, labels, kind, count, sum, buckets, "createdAt"');
    if (error) throw new Error(error.message);
    return data || [];
  },
});

Deno.serve(handler);
