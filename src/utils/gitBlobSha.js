// Compute the Git blob SHA-1 of text content — the same `sha` GitHub's Contents API returns for a
// file. Used for optimistic concurrency on topic/schedule commits: the editor remembers the blob SHA
// it loaded, commits against it, and a mismatch (another machine pushed in the meantime) surfaces as a
// conflict instead of a silent overwrite. Git hashes the bytes `"blob <byteLength>\0" + content`.
export async function gitBlobSha(content) {
  const body = typeof content === 'string' ? new TextEncoder().encode(content) : content || new Uint8Array();
  const header = new TextEncoder().encode(`blob ${body.length}\u0000`);
  const bytes = new Uint8Array(header.length + body.length);
  bytes.set(header, 0);
  bytes.set(body, header.length);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
