import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createGitHubSnapshotHandler } from './handler.js';

const handler = createGitHubSnapshotHandler({
  fetchFn: fetch,
});

Deno.serve(handler);
