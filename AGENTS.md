# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Bakala ERP System — Enterprise Resource Planning & POS for Eman Bakery (شركة مخابز ايمان جدة للخبز). Next.js 16 App Router + Tailwind CSS 4 + Supabase.

### Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Production | `npm run start` |

### Environment Variables

The app requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. Placeholder values are sufficient for build/lint but real Supabase credentials are needed for runtime database operations.

### Key Architectural Constraints

- All monetary values: BIGINT in halalas (smallest SAR unit), converted to SAR only at presentation layer
- Double-Entry Ledger: `SUM(Debits) = SUM(Credits)` enforced before any write
- VAT (15% standard / 0% exempt) isolated at logic level before DB insert
- ZATCA Phase 2 e-invoicing compliance structure required on all invoice models
- See `.cursorrules` for the full rule set
