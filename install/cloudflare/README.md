# Deploying MasteryLS to Cloudflare Pages

MasteryLS is a client-rendered SPA. On **GitHub Pages**, deep routes (`/course/<id>/topic/<id>`) are
served by the `404.html` fallback **with an HTTP 404 status** — Googlebot treats that as "not found"
and never indexes the page, so client-side SEO is wasted. **Cloudflare Pages** serves the same shell
with an HTTP **200** via a `_redirects` rule, which lets Googlebot render the JS and index public
topics. This folder holds what you need to make that switch.

## Files

| File | Purpose | Where it must end up |
|---|---|---|
| `_redirects` | SPA fallback: unmatched routes → `/index.html` **200** (the actual fix) | root of the deployed dir (`dist/`) |
| `_headers` | Optional cache-control (immutable `/assets/*`, no-cache shell/SW) | root of the deployed dir (`dist/`) |
| `deploy-cloudflare.yml` | Sample GitHub Actions workflow that deploys a saved `site-<version>` artifact to Cloudflare Pages | copy to `.github/workflows/` |

`_redirects` and `_headers` are kept here (not in `public/`) so they ship **only** to Cloudflare and
don't leak into the GitHub Pages build while both exist. CI copies them into `dist/` at deploy time.
(If you prefer, you can instead move `_redirects` into `public/` so Vite copies it automatically — then
drop the copy step below. `_headers` can move the same way.)

## One-time Cloudflare setup

1. **Create the Pages project.** In the Cloudflare dashboard → Workers & Pages → Create → Pages →
   *Direct Upload* (we deploy a prebuilt `dist/`, not a Cloudflare build). Name it `masteryls`
   (matching `CLOUDFLARE_PAGES_PROJECT` in the workflow) and set the **production branch** to `main`.
   - CLI equivalent: `npx wrangler pages project create masteryls --production-branch=main`.
2. **Custom domain.** Pages project → Custom domains → add `masteryls.com` (and `www` if used).
   Easiest when the domain's DNS is on Cloudflare; otherwise follow the CNAME instructions it shows.
3. **API token for CI.** My Profile → API Tokens → Create Token → *Cloudflare Pages: Edit*. Note it.
4. **Account ID.** Shown on the Workers & Pages overview page (right sidebar).

## GitHub repo secrets to add

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the Pages:Edit token from step 3 |
| `CLOUDFLARE_ACCOUNT_ID` | the account ID from step 4 |

(`GRAFANA_ACCESS_TOKEN` already exists and is reused for the deployment annotation.)

## CI / CD pipeline changes

**Build (`.github/workflows/ci.yml`): no change required.** It still builds and uploads the
`site-<version>` artifact. The `cp dist/index.html dist/404.html` step is now harmless (Cloudflare
uses `_redirects` instead) — you can leave it or delete it.

**Deploy:** replace the GitHub Pages deploy with the Cloudflare one.

1. Copy `install/cloudflare/deploy-cloudflare.yml` to `.github/workflows/deploy-cloudflare.yml`.
2. It keeps your existing manual trigger and artifact lookup, and changes only the publish steps:
   - **Dropped:** `actions/upload-pages-artifact` + `actions/deploy-pages`, and the `pages`/`id-token`
     permissions and `github-pages` environment.
   - **Added:** `actions/checkout` (to read `install/cloudflare/_redirects` + `_headers`), a step that
     copies them into `dist/`, and a `cloudflare/wrangler-action@v3` step running
     `pages deploy dist --project-name=masteryls --branch=main` (the `--branch=main` is what makes it a
     **production** deploy rather than a preview).
   - The GitHub release, step-summary, and Grafana annotation steps are unchanged except the site URL
     comes from the `SITE_URL` env instead of the Pages deployment output.
3. Once Cloudflare is live and DNS is cut over, delete `.github/workflows/deploy.yml`.

## DNS cutover

Point `masteryls.com` at the Cloudflare Pages project (custom-domain step above) and remove the old
GitHub Pages DNS records / the repo's Pages configuration. Expect brief propagation.

## Verify the fix

After deploy, the whole reason for the move is that deep routes return **200**:

```
curl -sI https://masteryls.com/course/<publicCourseId>/topic/<topicId> | head -1
# want: HTTP/2 200   (GitHub Pages returned HTTP/2 404)
```

Then confirm a public topic renders for a logged-out visitor and, over the following days, that Google
Search Console's URL Inspection shows the page as indexable.
