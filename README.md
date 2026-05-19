# Bakala ERP System

**شركة مخابز ايمان جدة للخبز** — *"The Taste of Tradition"* (SINCE 2007)

Enterprise Resource Planning & Point of Sale system for Eman Bakery, a daily fresh bread manufacturing and retail business in Saudi Arabia.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4
- **Database & Auth**: Supabase (PostgreSQL + Auth + Realtime)
- **Language**: TypeScript (strict)

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment example and configure your Supabase credentials:
   ```bash
   cp .env.local.example .env.local
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Architecture Notes

- All monetary values stored as BIGINT (halalas) — converted to SAR at presentation layer only
- Double-Entry Ledger: every transaction enforces `SUM(Debits) = SUM(Credits)`
- VAT (15% or 0%) isolated at logic level before database insertion
- Prepared for ZATCA Phase 2 e-invoicing compliance
