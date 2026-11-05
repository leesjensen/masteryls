import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createLogPushHandler } from './handler.js';

const handler = createLogPushHandler({
  getEnv: (key: string) => Deno.env.get(key),
  fetchFn: fetch,
});

Deno.serve(handler);
