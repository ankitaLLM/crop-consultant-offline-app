# Cloud synchronization setup

TerraSync supports authenticated, cross-browser synchronization through Supabase. The app continues to save to IndexedDB first, so field work remains usable without a connection.

## 1. Create the backend

1. Create a Supabase project.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it once.
3. In **Authentication → URL Configuration**, set the Site URL to `https://ankitallm.github.io/crop-consultant-offline-app/` and add the same URL as an allowed redirect URL.
4. In **Authentication → Providers → Email**, enable email/password authentication. Decide whether new accounts require email confirmation.

## 2. Configure the public web client

In Supabase **Project Settings → API**, copy the Project URL and the publishable/anon browser key. Do not use the service-role key in this repository.

Set these public values in `src/config.js`:

```js
supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
supabasePublishableKey: 'YOUR_PUBLISHABLE_OR_ANON_KEY'
```

The browser key is intentionally public. Security comes from authentication, grants, and the row-level-security policies in `supabase/schema.sql`.

## 3. Use and verify

1. Deploy the updated site.
2. Open TerraSync in Chrome and select **Connect cloud**.
3. Create an account or sign in.
4. Add an observation and a field document, then select **Sync now**.
5. Open TerraSync in Edge, Safari, or another device and sign in with the same account.
6. The same observations and documents should download after sign-in.

Private/incognito sessions can synchronize while open and online. Unsynchronized offline records are erased if the final private window closes, so TerraSync warns the user not to close a private session while changes are queued.

## Security notes

- RLS restricts every row to its authenticated owner.
- Never publish a Supabase service-role key.
- For an organization-wide release, replace owner-only policies with organization membership policies and provision accounts through the organization's identity provider.
- The current synchronization scope is user-created observations and recommendation/sales documents. Bundled demonstration growers, fields, and product catalogs remain part of the application release.
