# CardMaxx app

The user-facing CardMaxx app. A single Expo (React Native) codebase builds the **website**, the **iPhone app**, and the **Android app**.

| Tab | What it does |
| --- | --- |
| **Home** | Net worth (can be hidden), every linked account grouped by type, spending by category for the month, and budgets. Tap an account to see its transactions. Tap **Benefits** on a credit card to see its reward rates. |
| **Wallet** | Your cards, with a switch per card for whether CardMaxx can use it at checkout. It also shows the best card for each category, and suggests cards that would earn more (this can be turned off). |
| **Activity** | Purchases made through CardMaxx checkout, the card that was charged, and the rewards earned. |
| **Help** | FAQ, a support phone line (shown once a number is set), and a contact form that emails through Resend. |
| **Settings** (gear icon, top left) | Profile photo, name, username, email and phone. Also password reset, show net worth, card suggestions, appearance (auto, light or dark), and log out. |

## Run it

```bash
cd client
npm install
npm run web          # website at http://localhost:8081
npm start            # then press i (iOS simulator) or a (Android), or scan the QR code with Expo Go
```

Sign in with **Continue with Google**, or any email plus a password of 8 or more characters. Sign-in is a demo for now (see [What's real and what's demo](#whats-real-and-whats-demo)). A new account starts with sample banks, cards and purchase history.

Checks:

```bash
npm run typecheck
npm run lint
```

## What's real and what's demo

| Piece | Status |
| --- | --- |
| All screens, navigation, light/dark mode, responsive layout | Real |
| Card catalog (43 cards, reward rates, caps, fees) | Real data, from `src/data/card_products.json` (copied from the prototype dataset; every row links to the issuer page) |
| Best-card math and card suggestions | Real (`src/data/rewards.ts`): value per dollar = earn rate × point value; ties go to the card added first |
| Contact form | Real once `RESEND_API_KEY` and `CONTACT_TO_EMAIL` are set in `client/.env`. Without them the form shows "not set up yet" |
| Bank linking, balances, transactions | **Demo.** `src/data/demo.ts` generates sample banks. Real linking goes through Plaid; see [PLAID.md](PLAID.md) |
| Sign-in and password reset | **Demo.** `src/services/auth.ts` has the same functions the real backend (Google sign-in, Supabase per the spec) will provide |
| Saved data | Kept on the device (AsyncStorage), per browser or phone. Moves to the backend with the real API |

## Where things are

```
src/
  app/                  screens (Expo Router: every file is a route)
    (tabs)/             Home, Wallet, Activity, Help, Settings + the responsive nav
    account/[id].tsx    account details and transactions
    card/[id].tsx       card benefits
    link.tsx            link a bank (Plaid goes here)
    add-card.tsx        add a card by hand
    budgets.tsx         edit budgets
    sign-in.tsx
    api/contact+api.ts  server route that emails the contact form via Resend
  brand/glyphs.ts       logo geometry + palette (shared with scripts/build-brand.ts)
  content/help.ts       FAQ text and support phone number: edit here
  data/                 card catalog, categories, rewards math, demo data, app store
  services/auth.ts      sign-in (demo)
  theme/                colors (light + dark), fonts, spacing
  ui/                   shared components: Button, Surface, Input, Switch, charts, CardArt, Logo, Sheet, Toast…
```

## Design system

- **Colors** (`src/theme/tokens.ts`) come from the brand palette: indigo `#4039DF`, periwinkle `#6A6CF0`, violet `#864BE5`, lavender `#A98BE6`, orchid `#E39BDD`, blush `#FDC1E6`, ice `#CADCEB`, mist `#ECEBF0`, and ink `#1A1640`. The background is a warm lilac (`#F6F2FA`), not plain white. Dark mode has its own set of values.
- **Type:** Bricolage Grotesque for headings and amounts, Plus Jakarta Sans for everything else. The CARDMAXX wordmark is custom lettering (`src/brand/glyphs.ts`) carried over from the star logo.
- **Logo files:** `../branding/`. Regenerate them with `npm run brand` after editing `glyphs.ts`.
- **Components** follow the shadcn/Watermelon pattern of small, composable, token-driven pieces. They're built on React Native primitives so they work on web, iOS and Android. Icons are [Lucide](https://lucide.dev).

## Deploying

- **Web:** `npx expo export -p web` builds the site and the `/api/contact` server route. Host it on EAS Hosting (`npx eas-cli@latest deploy`) or any Node host, and set the `.env` values there.
- **Phones:** `npx eas-cli@latest build`. Before building, set `plugins → expo-router → origin` in `app.json` to the deployed web URL, so the phone app can reach `/api/contact`.

## Next up (from the feature list)

- Language support
- Net worth chart over time
- Restrictive budgets: block a card or purchase once a budget is hit
- Investment resources
- "Remember this device" and session behavior. Decide how long a session lasts and how logout works across devices before building the real auth
