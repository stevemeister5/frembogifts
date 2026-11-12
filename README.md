# Giftopia Storefront

Giftopia is an Express application deployed on Vercel. Its storefront is rendered from an EJS template using live product, offer, and campaign data from Vercel Postgres.

## Features

- **Exact UI/UX Copy** - Matching the Purpink design including:
  - Header with navigation, search, and cart
  - Hero section with same-day delivery badge
  - Category filters (Flowers, Hampers, Gifts, Accessories)
  - Product cards with options
  - Filter by style, flower type, occasion, and budget
  - Social media links
  - Full footer with links

- **Responsive Design** - Works mobile to desktop
- **Interactive Elements** - Mobile menu, filter tabs, budget selection
- **Vercel-Optimized** - Ready for one-click deployment

## Deployment on Vercel

1. Connect the repository to Vercel and provision Vercel Postgres.
2. Deploy using the included `vercel.json` configuration.
3. For a new database, call `/api/setup` once to create the tables and seed initial data.

Configure the Postgres environment variables through the Vercel integration. Set `JWT_SECRET` to a strong secret for production authentication.

## Project Structure

```
Giftopia/
├── server.js          - Express API and server-rendered storefront route
├── views/index.ejs    - Dynamic storefront template
├── admin.html         - Admin interface
├── vercel.json        - Vercel routing and function configuration
└── README.md          - This file
```

## UI Elements Copied from Purpink

- Color scheme: Soft pink/peach accents on off-white background
- Typography: Playfair Display for headings, Inter for body
- Navigation: Sticky header with search and cart
- Hero: Same-day delivery badge, headline, category selectors
- Products: Cards with image, title, price, and option buttons
- Filters: Style, flower type, occasion, budget chips
- Footer: Company info, links, social media, payment methods
