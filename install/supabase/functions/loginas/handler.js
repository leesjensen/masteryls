// TEMPORARY debug backdoor: lets a root user obtain a real Supabase OTP for
// any user's email so they can authenticate as that user without receiving
// the email. Delete this whole function directory + the service.impersonateLogin
// method + the appBar menu item to remove the backdoor.

import { createClient } from 'jsr:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export function createLoginAsHandler({ createSupabaseClientFromAuthHeader, getEnv }) {
  return async function handleLoginAs(req) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401);

    const supabaseUrl = getEnv('SUPABASE_URL');
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return jsonResponse({ error: 'Server misconfigured' }, 500);

    const callerClient = createSupabaseClientFromAuthHeader(authHeader);
    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData?.user) return jsonResponse({ error: 'Invalid user token' }, 401);

    // Caller must currently hold the root role.
    const { data: roleRows, error: roleError } = await callerClient.from('role').select('id').eq('user', authData.user.id).eq('right', 'root').limit(1);
    if (roleError) return jsonResponse({ error: roleError.message }, 500);
    if (!Array.isArray(roleRows) || roleRows.length === 0) {
      return jsonResponse({ error: 'Only root users may use this endpoint.' }, 403);
    }

    const payload = await req.json().catch(() => ({}));
    const targetEmail = String(payload?.email || '').trim().toLowerCase();
    if (!targetEmail) return jsonResponse({ error: 'email is required' }, 400);

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
    });
    if (error) return jsonResponse({ error: error.message }, 400);

    const otp = data?.properties?.email_otp;
    if (!otp) return jsonResponse({ error: 'Supabase did not return an OTP.' }, 500);

    return jsonResponse({ email: targetEmail, token: otp });
  };
}
