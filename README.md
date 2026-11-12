# Giftopia Storefront

Giftopia is an Express application deployed on Vercel. Its storefront is rendered from an EJS template using live product, offer, and campaign data from Vercel Postgres.

## Features

- Server-rendered products, offers, and campaigns from Vercel Postgres
- Client-side search, tier filtering, and sorting
- Shopping cart, customer accounts, and checkout flows
- Admin interface for managing products, offers, and campaigns
- Responsive storefront with mobile navigation

## Deployment on Vercel

1. Connect the repository to Vercel and provision Vercel Postgres.
2. Deploy using the included `vercel.json` configuration.
3. For a new database, call `/api/setup` once to create tables and seed initial data.

Configure Postgres environment variables through the Vercel integration and set a strong `JWT_SECRET` for production authentication.

For local development, run `npm install`, configure the Postgres environment variables, then run `npm start`. Run `npm test` for the template tests.

## Project Structure

```
Giftopia/
├── server.js          - Express API and server-rendered storefront route
├── views/index.ejs    - Dynamic storefront template
├── admin.html         - Admin interface
├── vercel.json        - Vercel routing and function configuration
├── package.json       - App scripts and runtime dependencies
├── package-lock.json  - Locked npm dependencies
├── start.sh           - Local start helper
├── test/              - Automated tests
└── README.md          - This file
```
