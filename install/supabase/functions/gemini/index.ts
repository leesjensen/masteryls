// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
interface reqPayload {
  endpoint: string;
  method: string;
  model?: string;
  body: string | null;
}

const defaultModel = 'gemini-3-flash-preview';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { method, model, body }: reqPayload = await req.json();

  let reqBody = undefined;
  if (body) {
    reqBody = JSON.stringify(body);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || defaultModel}:generateContent`;
  const token = Deno.env.get('GEMINI_API_KEY');
  const canvasRequest = {
    method: method,
    body: reqBody,
    headers: {
      'X-goog-api-key': token,
      'Content-Type': 'application/json',
    },
  };

  const response = await fetch(url, canvasRequest);
  const data = await response.json();

  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json', Connection: 'keep-alive' } });
});
