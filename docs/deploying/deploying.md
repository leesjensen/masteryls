# Deploying MasteryLS

MasteryLS runs as a frontend hosted on GitHub Pages with Supabase as its backend. The repository's GitHub Actions workflow builds and deploys the frontend when code is pushed to `main` (or when the workflow is run manually).

## 1. Fork and configure the frontend

1. Fork the [MasteryLS repository](https://github.com/leesjensen/masteryls).
2. In the fork's Settings → Pages, select **GitHub Actions** as the build and deployment source.
3. In the repository's Actions secrets, add:
   - `SUPABASE_URL`: the Supabase project URL.
   - `SUPABASE_KEY`: the project's publishable/anon key.
4. Push to `main` or run the Pages workflow manually. The workflow creates `config.js` during the build; do not commit local Supabase credentials.

MasteryLS uses root-relative app routes and assets. Host it at the root of a domain or on a custom domain; a GitHub Pages project subpath such as `/masteryls/` is not configured by the current build.

## 2. Create and configure Supabase

Install the project dependencies from the repository root so the bundled Supabase CLI is available:

```sh
npm install
```

Create a Supabase Management API access token, then run the initializer from the repository root:

```sh
node install/initproject.js \
  --token "$SUPABASE_ACCESS_TOKEN" \
  --org "your-organization-id" \
  --project "masteryls-production" \
  --password "$SUPABASE_DATABASE_PASSWORD" \
  --root-email "root@example.com" \
  --root-name "Root User" \
  --secrets "GEMINI_API_KEY=your-gemini-key,CANVAS_API_KEY=your-canvas-key"
```

The initializer creates the Supabase project if it does not exist. For a newly created project, it applies `install/supabase/schema.sql`, deploys every function under `install/supabase/functions/`, registers any supplied secrets, updates the auth confirmation email template, creates the root user/role, and writes a local root-level `config.js`.

The CLI requires `--token`, `--org`, `--project`, `--password`, `--root-email`, and `--root-name`. `--region`, `--api`, and `--secrets` are optional. Add `--help` to display the current CLI usage.

> [!IMPORTANT]
>
> If the project already exists, the initializer does **not** apply schema changes, deploy function updates, or create a root role. It only retrieves the existing project config and writes `config.js`. Apply later schema changes separately and deploy changed Edge Functions with the Supabase CLI.

## 3. Keep frontend and backend in sync

- **Frontend:** add `SUPABASE_URL` and `SUPABASE_KEY` as GitHub Actions secrets; the `main` workflow builds, runs Edge Function and Playwright checks, and publishes `dist/` to GitHub Pages.
- **Edge Functions:** deploy changed functions with `supabase functions deploy <function-name> --project-ref <project-ref>`. Set required Edge Function secrets in Supabase.
- **Database:** apply changes to `install/supabase/schema.sql` to the hosted project separately. The initializer only applies the schema during first-time project creation.
- **Contract changes:** release client and Edge Function changes together when request or response shapes change.

For local development, keep the generated root-level `config.js` out of Git. It is ignored by the repository because it contains installation-specific configuration.
