const snapshotCache = new Map();

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

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

function parseRawGitHubUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ''));
    if (url.hostname !== 'raw.githubusercontent.com') {
      return null;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length < 3) {
      return null;
    }

    const [owner, repository, ref, ...pathParts] = segments;
    const path = pathParts.join('/');
    if (!owner || !repository || !ref) {
      return null;
    }

    return { owner, repository, ref, path };
  } catch {
    return null;
  }
}

function cacheKeyFromParts(owner, repository, ref) {
  return `${owner}/${repository}@${ref}`;
}

export function replaceRawGitHubRef(rawUrl, nextRef) {
  const parsed = parseRawGitHubUrl(rawUrl);
  if (!parsed || !nextRef) {
    return rawUrl;
  }

  const suffix = parsed.path ? `/${parsed.path}` : '';
  return `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repository}/${nextRef}${suffix}`;
}

export async function resolveRawGitHubSnapshotRef(rawUrl, token, snapshotRefResolver = null) {
  const parsed = parseRawGitHubUrl(rawUrl);
  if (!parsed) {
    return null;
  }

  if (isSha(parsed.ref)) {
    return parsed.ref;
  }

  const key = cacheKeyFromParts(parsed.owner, parsed.repository, parsed.ref);
  if (snapshotCache.has(key)) {
    return snapshotCache.get(key);
  }

  if (typeof snapshotRefResolver === 'function') {
    try {
      const resolvedFromResolver = await snapshotRefResolver({ owner: parsed.owner, repository: parsed.repository, ref: parsed.ref, token });
      const normalizedResolverSha = String(resolvedFromResolver || '').trim();
      if (isSha(normalizedResolverSha)) {
        snapshotCache.set(key, normalizedResolverSha);
        return normalizedResolverSha;
      }
    } catch {
      // Fall back to direct fetch strategy below.
    }
  }

  try {
    const endpoint = `https://github.com/${parsed.owner}/${parsed.repository}.git/info/refs?service=git-upload-pack`;
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'text/plain, */*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      snapshotCache.set(key, parsed.ref);
      return parsed.ref;
    }

    const refsText = await response.text();
    const branchRef = decodeURIComponent(parsed.ref);
    const sha = parseBranchShaFromInfoRefs(refsText, branchRef);
    const resolvedRef = sha || parsed.ref;
    snapshotCache.set(key, resolvedRef);
    return resolvedRef;
  } catch {
    snapshotCache.set(key, parsed.ref);
    return parsed.ref;
  }
}

export async function resolveSnapshotRawUrl(rawUrl, token, snapshotRefResolver = null) {
  const parsed = parseRawGitHubUrl(rawUrl);
  if (!parsed) {
    return rawUrl;
  }

  const snapshotRef = await resolveRawGitHubSnapshotRef(rawUrl, token, snapshotRefResolver);
  if (!snapshotRef) {
    return rawUrl;
  }

  return replaceRawGitHubRef(rawUrl, snapshotRef);
}

export function invalidateRawGitHubSnapshot(rawUrl) {
  const parsed = parseRawGitHubUrl(rawUrl);
  if (!parsed) {
    return;
  }

  const key = cacheKeyFromParts(parsed.owner, parsed.repository, parsed.ref);
  snapshotCache.delete(key);
}

export function setRawGitHubSnapshot(rawUrl, sha) {
  const parsed = parseRawGitHubUrl(rawUrl);
  const normalizedSha = String(sha || '').trim();
  if (!parsed || !isSha(normalizedSha)) {
    return;
  }

  const key = cacheKeyFromParts(parsed.owner, parsed.repository, parsed.ref);
  snapshotCache.set(key, normalizedSha.toLowerCase());
}
