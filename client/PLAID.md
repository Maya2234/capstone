# Connecting Plaid

Right now **Link an account** uses demo banks (`src/app/link.tsx` and `src/data/demo.ts`). This guide swaps in real Plaid in **Sandbox**, which uses fake banks and costs nothing. The screens stay the same; only where the data comes from changes.

Do the steps in order and stop after each one to check it works.

## How Plaid works (1 minute)

```
App ──(1) ask for a link token──▶ our server ──▶ Plaid  /link/token/create
App ◀──────────── link_token ─────────────────
App opens Plaid Link (Plaid's own UI). The user picks a bank and logs in there.
App ◀── public_token (one-time) ── Plaid Link
App ──(2) send public_token──▶ our server ──▶ Plaid  /item/public_token/exchange
                                  stores access_token (secret, never sent to the app)
App ──(3) "get my accounts"──▶ our server ──▶ Plaid  /accounts/get, /transactions/sync
```

The **secret** and the **access_token** must only ever live on the server. That's why steps 1–3 go through our API routes, not the app.

## Step 1: Plaid account (you)

1. Sign up at dashboard.plaid.com (free).
2. Go to **Developers → Keys** and copy your **client_id** and **Sandbox secret**.
3. Put them in `client/.env` (copy `.env.example`):
   ```
   PLAID_CLIENT_ID=...
   PLAID_SECRET=...
   PLAID_ENV=sandbox
   ```
4. Under **Developers → API → Allowed redirect URIs**, nothing is needed for web. For phones, see step 5.

## Step 2: Server routes (we build together)

Add three Expo API routes next to `src/app/api/contact+api.ts`:

| Route | Calls Plaid | Returns to the app |
| --- | --- | --- |
| `POST /api/plaid/link-token` | `/link/token/create` with `products: ['transactions']`, `country_codes: ['US']` and the signed-in user's id | `{ link_token }` |
| `POST /api/plaid/exchange` | `/item/public_token/exchange`, then saves `access_token` + `item_id` for this user | `{ ok: true }` |
| `GET /api/plaid/accounts` | `/accounts/get` (and `/transactions/sync` for history) for each saved item | accounts in our `Account` shape (`src/data/types.ts`) |

You'll need **somewhere to save access tokens**: a database row per linked bank, encrypted, as the Ethics Statement promises. API routes forget everything between requests, so this is the point where the Supabase backend from the spec comes in. Until then, the prototype Go server (`feature/cardstack-prototype` branch) already does the token storage and encryption and could serve these three endpoints.

## Step 3: Plaid Link on the website

```bash
npm install react-plaid-link
```

In `link.tsx`, replace the demo list with a **Continue with Plaid** button:
1. Call `/api/plaid/link-token` and keep the token.
2. Use `usePlaidLink({ token, onSuccess })` from `react-plaid-link`, and call `open()` when the button is pressed.
3. In `onSuccess(public_token)`, POST it to `/api/plaid/exchange`, fetch `/api/plaid/accounts`, and pass the result to `linkAccounts(...)` from the store (the same call the demo uses).

Test with Sandbox: pick any bank and log in with **user_good / pass_good**.

## Step 4: Plaid Link on phones

```bash
npx expo install react-native-plaid-link-sdk
```

- This is a native module, so it **won't run in Expo Go**. Make a development build with `npx expo run:ios` / `npx expo run:android`, or `npx eas-cli@latest build --profile development`.
- Put the phone version in `src/services/plaid.native.ts` and the web version in `src/services/plaid.web.ts`, both exporting `openPlaidLink(token): Promise<public_token>`. Expo picks the right file per platform, so `link.tsx` stays the same everywhere.
- For OAuth banks (Chase and others) on iOS, Plaid needs a redirect URI. Use `cardmaxx://plaid` (the app's scheme is `cardmaxx`) and add it in the Plaid dashboard.

## Step 5: Switch off demo data

- In `store.ts` `starterData`, start new users with empty `accounts`, `cards` and `purchases`.
- Replace `transactionsFor` in `src/data/derive.ts` with data from `/api/plaid/accounts`.
- Remove the "Demo mode" badge in `link.tsx`.

## Going live later

Sandbox → Production needs Plaid's production access request (a company profile and a use-case review). Do this near the end of the course timeline, not now.
