import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createTelemetryHandler } from './handler.js';

// Service-role client: this function writes aggregate metric rows that no end user may touch.
const supabase = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');

const handler = createTelemetryHandler({
  recordMetrics: async (calls: unknown[], counters: unknown[]) => {
    const { error } = await supabase.rpc('record_client_metrics', { calls, counters });
    if (error) throw new Error(error.message);
  },
});

Deno.serve(handler);
