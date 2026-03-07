import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
interface reqPayload {
  endpoint: string;
  method: string;
  body: string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { endpoint, method, body }: reqPayload = await req.json();

  let reqBody = undefined;
  if (body) {
    reqBody = JSON.stringify(body);
  }

  const url = `https://byu.instructure.com/api/v1${endpoint}`;
  const token = Deno.env.get('CANVAS_API_KEY');
  const canvasRequest = {
    method: method,
    body: reqBody,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const response = await fetch(url, canvasRequest);
  const data = await response.json();

  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json', Connection: 'keep-alive' } });
});
