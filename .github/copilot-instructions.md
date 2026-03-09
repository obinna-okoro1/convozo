# Convozo – Copilot Instructions

## Sizing & Units

- **Always use `rem` instead of `px`** for all sizing values (width, height, padding, margin, font-size, border-radius, gaps, transforms, box-shadow offsets, etc.).
- This applies to:
  - Tailwind arbitrary values: use `min-w-[2.75rem]` not `min-w-[44px]`
  - Custom CSS properties: use `width: 0.5rem` not `width: 8px`
  - Inline styles: use `padding: 1.25rem` not `padding: 20px`
  - Animations/keyframes: use `translateY(1.25rem)` not `translateY(20px)`
- **Conversion**: `1rem = 16px`. Divide the px value by 16 to get rem.
- **Why**: rem units scale with the user's browser font-size setting, ensuring consistent and accessible layouts across all screen sizes and user preferences.
- The only exceptions are `0` (no unit needed), `1px` borders where a hairline is explicitly desired (use `border` Tailwind classes instead), and SVG `stroke-width`/`viewBox` attributes.

## Tech Stack

- Angular 21 (standalone components, signals, lazy routes)
- Supabase (PostgreSQL, Edge Functions with Deno, Realtime, Storage)
- Flutterwave (subaccounts, webhooks, Standard payments)
- Tailwind CSS (utility-first, dark theme, mobile-first responsive design)
- PWA (manifest.json, service worker)

## Code Style

- Use Tailwind utility classes over custom CSS wherever possible.
- Mobile-first responsive design: base styles for mobile, then `sm:`, `lg:` breakpoints.
- Touch-friendly: minimum 44×44 target sizes for interactive elements (use `min-w-[2.75rem] min-h-[2.75rem]`).
- All components are standalone (no NgModules).
- Password policy: **8-character minimum**, enforced on both client and server.

## Environment Separation

- `supabase/.env` → **local dev only** (read by `supabase functions serve`)
- `supabase secrets set` → **production only** (stored in Supabase remote vault)
- `supabase/.env.production` → **reference file** (committed, placeholder values only)
- **Never** run `supabase secrets set --env-file supabase/.env`

## Deployment

- Frontend: `npx wrangler pages deploy dist/convozo-app/browser --project-name=convozo`
- Backend: `supabase db push && supabase functions deploy`
- Secrets: `supabase secrets set KEY=VALUE` (one at a time, never from file)
