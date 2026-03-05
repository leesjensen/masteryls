/*
// Implementation with query against database.


import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

interface ReqPayload {
  endpoint: string;
  method: string;
  body: unknown | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function createSupabaseClientForRequest(req: Request): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment not configured');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
}

async function getAuthenticatedUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error('User not authenticated');

  return user;
}

async function validateHasEditorRightForCourse(supabase: SupabaseClient, userId: string, courseId: string): Promise<void> {
  const { data, error } = await supabase.from('role').select('id').eq('user', userId).eq('right', 'editor').eq('object', courseId).maybeSingle();

  if (error || !data) throw new Error('Failed to verify user permissions for course');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { endpoint, method, body }: ReqPayload = await req.json();

    const courseId = endpoint.match(/^\/courses\/([^\/?]+)/)?.[1] ?? null;
    if (!courseId) throw new Error('Course ID not found in endpoint');

    const supabase = createSupabaseClientForRequest(req);
    const user = await getAuthenticatedUser(supabase);
    await validateHasEditorRightForCourse(supabase, user.id, courseId);

    const canvasToken = Deno.env.get('CANVAS_API_KEY');
    if (!canvasToken) {
      return new Response(JSON.stringify({ error: 'Canvas API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const canvasResponse = await fetch(`https://byu.instructure.com/api/v1${endpoint}`, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Authorization: `Bearer ${canvasToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await canvasResponse.json();

    return new Response(JSON.stringify(data), {
      status: canvasResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', Connection: 'keep-alive' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
*/

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
