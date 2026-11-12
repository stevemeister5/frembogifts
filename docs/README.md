# Giftopia Storefront

Giftopia is an Express application deployed on Vercel. Its storefront is rendered from an EJS template using live product, offer, and campaign data from Vercel Postgres.

## Features

- Server-rendered products, offers, and campaigns from Vercel Postgres
- Client-side search, tier and occasion filtering based on product tags, and sorting
- Shopping cart, customer accounts, and checkout flows
- Admin interface for managing products and their occasion tags, offers, and campaigns
- Responsive storefront with mobile navigation and optional WhatsApp contact
- Locally compiled Tailwind stylesheet and locally served product images

## Deployment on Vercel

1. Connect the repository to Vercel and provision Vercel Postgres.
2. Deploy using the included `vercel.json` configuration.
3. Configure `JWT_SECRET` with a strong random value. Set `WHATSAPP_NUMBER` to the Giftopia contact number in international digits-only format (for example `2557...`); WhatsApp links remain hidden when it is unset.
4. Call `/api/setup` once to create or migrate tables and seed initial data. This stores occasion tags and maps known catalog photos to local assets. The storefront also derives tags for known legacy products with no stored tags, so occasion filters work before this migration is run.

Vercel receives the prebuilt `public/styles.css` and image assets through `vercel.json`. When changing Tailwind classes, run `npm run build:css` and include the generated stylesheet in the commit. The build is also run by `npm start` for local development.

From the repository root, run `npm install`, configure the Postgres environment variables, then run `npm start`. Run `npm test` for the focused template and static-asset tests.

## Project Structure

```
Repository root/
├── server.js          - Express API and server-rendered storefront route
├── views/index.ejs    - Dynamic storefront template
├── views/admin.ejs    - Server-rendered admin interface
├── src/tailwind.css   - Tailwind source and shared component styles
├── public/            - Compiled CSS and locally served images
├── vercel.json        - Vercel routing and function configuration
├── package.json       - App scripts and runtime dependencies
├── package-lock.json  - Locked npm dependencies
├── start.sh           - Local start helper
├── test/              - Automated tests
└── docs/               - Project, market, regulatory, and product documentation
    ├── README.md
    ├── PROJECT_DOCUMENTATION.md
    ├── RESEARCH_FINDINGS.md
    ├── REGULATORY_REQUIREMENTS.md
    ├── PRICE_ANALYSIS.md
    ├── GENERATED_PRODUCTS.md
    ├── IMAGE_CREDITS.md
    └── brand_and_ux_strategy_tanzania.md
```
