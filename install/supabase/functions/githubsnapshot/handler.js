export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REF_TTL_MS = 30 * 1000;
const refCache = new Map();
const inFlight = new Map();

function isSha(value) {
  return /^[a-f0-9]{40}$/i.test(String(value || ''));
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseBranchShaFromInfoRefs(infoRefsText, branchRef) {
  const normalizedBranch = String(branchRef || '').trim();
  if (!normalizedBranch) {
    return null;
  }

  const refPattern = `refs/heads/${escapeRegex(normalizedBranch)}`;
  const regex = new RegExp(`(?:^|\\n)(?:[0-9a-f]{4})?([a-f0-9]{40})\\s+${refPattern}(?:\\0[^\\n]*)?`, 'i');
  const match = String(infoRefsText || '').match(regex);
  return match?.[1] || null;
}

function isSafeIdentifier(value) {
  return /^[A-Za-z0-9._-]+$/.test(String(value || ''));
}

function cacheKey(owner, repository, ref) {
  return `${owner}/${repository}@${ref}`;
}

function getCachedSha(owner, repository, ref) {
  const key = cacheKey(owner, repository, ref);
  const item = refCache.get(key);
  if (!item) {
    return null;
  }

  if (Date.now() > item.expiresAt) {
    refCache.delete(key);
    return null;
  }

  return item.sha;
}

function setCachedSha(owner, repository, ref, sha) {
  const key = cacheKey(owner, repository, ref);
  refCache.set(key, {
    sha,
    expiresAt: Date.now() + REF_TTL_MS,
  });
}

export function createGitHubSnapshotHandler({ fetchFn = fetch }) {
  return async function handleGitHubSnapshot(req) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    let payload = {};
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const owner = String(payload?.owner || '').trim();
    const repository = String(payload?.repository || '').trim();
    const ref = decodeURIComponent(String(payload?.ref || '').trim());

    if (!owner || !repository || !ref) {
      return new Response(JSON.stringify({ error: 'owner, repository, and ref are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isSafeIdentifier(owner) || !isSafeIdentifier(repository)) {
      return new Response(JSON.stringify({ error: 'Invalid owner or repository format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isSha(ref)) {
      return new Response(JSON.stringify({ sha: ref.toLowerCase() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cachedSha = getCachedSha(owner, repository, ref);
    if (cachedSha) {
      return new Response(JSON.stringify({ sha: cachedSha, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const key = cacheKey(owner, repository, ref);
      let shaPromise = inFlight.get(key);
      if (!shaPromise) {
        shaPromise = (async () => {
          const endpoint = `https://github.com/${owner}/${repository}.git/info/refs?service=git-upload-pack`;
          const response = await fetchFn(endpoint, {
            method: 'GET',
            headers: {
              Accept: 'text/plain, */*',
              'User-Agent': 'masteryls-githubsnapshot',
            },
          });

          if (!response.ok) {
            return ref;
          }

          const refsText = await response.text();
          return parseBranchShaFromInfoRefs(refsText, ref) || ref;
        })();
        inFlight.set(key, shaPromise);
      }

      const sha = await shaPromise;
      inFlight.delete(key);
      if (isSha(sha)) {
        setCachedSha(owner, repository, ref, sha);
      }

      return new Response(JSON.stringify({ sha, fallback: !isSha(sha) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch {
      inFlight.delete(cacheKey(owner, repository, ref));
      return new Response(JSON.stringify({ sha: ref, fallback: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  };
}
