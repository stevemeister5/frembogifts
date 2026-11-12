# Giftopia - 1:1 Purpink.co.ke Clone

A faithful recreation of [Purpink.co.ke](https://www.purpink.co.ke/) built with static HTML and Tailwind CSS for easy deployment on Vercel.

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

1. Push this repository to GitHub/GitLab
2. Connect your repository to Vercel
3. Deploy - Vercel will automatically detect the static HTML

Alternatively, deploy directly:
- Go to [Vercel](https://vercel.com)
- Click "New Project"
- Import this repository
- Set the build command to: (leave empty for static HTML)
- Set the output directory to: (leave empty)
- Click Deploy

## Project Structure

```
Giftopia/
├── index.html    - Main HTML file with full UI copy
├── vercel.json   - Vercel deployment configuration
├── public/       - Additional assets can be placed here
└── README.md     - This file
```

## UI Elements Copied from Purpink

- Color scheme: Soft pink/peach accents on off-white background
- Typography: Playfair Display for headings, Inter for body
- Navigation: Sticky header with search and cart
- Hero: Same-day delivery badge, headline, category selectors
- Products: Cards with image, title, price, and option buttons
- Filters: Style, flower type, occasion, budget chips
- Footer: Company info, links, social media, payment methods
