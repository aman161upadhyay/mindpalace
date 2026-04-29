# Hand-off Summary: Mind Palace Platform (April 2026)

This document provides a comprehensive overview of the technical and functional updates implemented over the past week. Use this as context for subsequent development with Claude Code.

---

## 🚀 Major Features Implemented

### 1. Daily Highlights Email ("The Re-Kindle")
- **Functionality**: A daily automated email that sends users 5 random highlights from their collection to improve retention.
- **Cron Job**: Implemented as a Vercel Serverless Function (`api/cron/daily-highlights.ts`). Triggered via Vercel Cron at 13:00 UTC (9:00 AM EST) daily.
- **Email Provider**: Integrated with **Resend**. 
  - *Status*: Currently using `onboarding@resend.dev`. 
  - *Limitation*: Can only send to the registered Resend account email (`aman.r.upadhyay@gmail.com`) until a custom domain is verified.
- **User Preference**: Added a `dailyEmailEnabled` column to the `users` table. Users can toggle this in the Settings dashboard.

### 2. Search Intelligence Upgrade
- **Improvement**: Migrated from standard SQL `LIKE` to case-insensitive `ILIKE` for all highlight searches.
- **Scope**: Queries now match across text content, page titles, notes, and source domains regardless of capitalization.

### 3. Luxurious Minimalist Landing Page
- **Typography**: Integrated **Playfair Display** (Serif) for a sophisticated brand feel.
- **Aesthetic**: Moved away from "AI-slop" imagery to a high-end, minimalist layout focused on typography and negative space.
- **Feature Showcase**: Added an elegant, glass-morphic "Floating Highlight Card" that demonstrates the product's core value using a classic Plutarch quote.
- **Responsive Shortcuts**: The hero section now displays both Windows (`Ctrl`) and Mac (`⌘`) keyboard shortcuts for the Chrome Extension.

### 4. Security & Environment Hardening
- **Forgot Password Flow**: Implemented a new route and API endpoint (`/api/auth/reset-password`) that verifies identity via matching username + email.
- **Secret Management**:
  - Migrated `JWT_SECRET` to **Sensitive** storage in Vercel.
  - Configured `RESEND_API_KEY` and `CRON_SECRET` for production and development environments.
  - Created `DEV_NOTES.md` to track sensitive data rotation needs and known vulnerabilities.

---

## 🛠 Technical Architecture Updates

### Database Schema (`src/schema.ts`)
- Added `dailyEmailEnabled` (boolean, default: true).
- Added `theme` (text, default: 'dark').
- Backend uses Drizzle ORM with Neon (PostgreSQL).

### API & Routing
- **New Endpoints**:
  - `PATCH /api/auth/me`: Allows updating user profile preferences (theme, email notifications).
  - `POST /api/auth/reset-password`: Identity-match based password reset.
  - `GET /api/cron/daily-highlights`: Secured via `Authorization: Bearer <CRON_SECRET>`.
- **Frontend Routing**: Powered by `wouter` for lightweight SPA navigation.

### UI Design System
- **Theme Engine**: Refined `ThemeContext.tsx` and `index.css`.
- **Light Mode Fixes**: Adjusted contrast for text and badges in light mode (darkened `#827c75` to `#5a5f5c` and added `font-medium` weights) to ensure legibility on the warm plaster background.
- **Tailwind v4**: Using Tailwind v4 with custom variants (e.g., `light:` prefix added to support specialized overrides).

---

## ⚠️ Known Gotchas & Pending Tasks

| Task | Status | Priority |
|------|--------|----------|
| **CORS Lockdown** | ❌ `Access-Control-Allow-Origin: *` | High (Security) |
| **Neon Password Rotation** | ⚠️ Password leaked in logs | High (Security) |
| **Resend Domain Verification**| ❌ Restricted to one email | Medium (Launch) |
| **Chrome Extension Manifest** | ⚠️ Needs public keys/IDs | Medium (Launch) |
| **Email Verification** | ❌ Not required on signup | Low (Product) |

---

## 📂 Key Files for Review
- `api/cron/daily-highlights.ts`: Email delivery logic.
- `src/pages/Home.tsx`: Hero section & branding.
- `src/pages/Settings.tsx`: User preferences & shortcuts.
- `DEV_NOTES.md`: Comprehensive list of technical limitations and secrets.
- `vercel.json`: Routing, headers, and cron configuration.

---
*Last updated: 2026-04-26*
