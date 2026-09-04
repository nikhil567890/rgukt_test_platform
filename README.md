# RGUKT TestPrep Platform

A full-stack entrance exam test preparation platform for **RGUKT CET** featuring an **Admin Panel** and a **Student Panel**.

## Key Features

### 🎓 Student Panel (Premium Gated)
- **Timed MCQ Entrance Papers**: Exam interface with countdown timer, auto-submit, question review palette.
- **Detailed Step-by-Step Solutions**: Complete post-exam analysis showing student choices vs correct answers with explanations.
- **Topper Benchmark & Score Comparison**: Compare score and gap against the test topper.
- **Daily Study Streak Tracker**: Consecutive calendar day streak counter with longest streak stats.
- **Razorpay Premium Paywall**: One-time payment of ₹3000 to unlock student test access with signature verification.

### 🛡️ Admin Panel
- **Overview Analytics Dashboard**: Total students, premium count, total test papers, attempts count, and Razorpay revenue collected.
- **Test Paper & Question Management**: Create, edit, publish/unpublish test papers, dynamic MCQ builder with marks and explanations.
- **Students Directory**: List students, view streak stats, and grant manual premium access (offline approval).
- **Test Level Analytics & Leaderboard**: Score distribution buckets (0-20%, etc.), topper stats, and top 10 rankers leaderboard.

---

## Tech Stack
- **Frontend**: React 19 (Vite), Tailwind CSS v4, Lucide Icons, Motion
- **Backend**: Node.js, Express.js, TypeScript (`tsx`, `esbuild`)
- **Database & ORM**: SQLite / Prisma ORM
- **Authentication**: JWT & `bcryptjs` password hashing (Role `ADMIN` and `STUDENT`)
- **Payments**: Razorpay Node SDK & HMAC SHA256 signature verification

---

## Environment Variables Configuration

Copy `.env.example` to `.env`:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="rgukt-testprep-super-secret-jwt-key-2026"
RAZORPAY_KEY_ID="rzp_test_sampleKey123"
RAZORPAY_KEY_SECRET="sampleSecretKey456"
PREMIUM_AMOUNT_PAISE=300000
```

---

## Running Database Migrations & Seeding

```bash
# 1. Synchronize SQLite Database Schema
npm run db:push

# 2. Seed Initial Admin & Demo Accounts + Sample Test Paper
npm run db:seed
```

### Pre-configured Demo Accounts

| Role | Email | Password | Status |
|---|---|---|---|
| **Admin** | `admin@rgukt.ac.in` | `admin123` | Full Admin Access |
| **Premium Student** | `student@rgukt.ac.in` | `student123` | Premium Unlocked |
| **Free Student** | `free@rgukt.ac.in` | `demo1234` | Premium Locked |

---

## Development & Production Commands

```bash
# Start Dev Server (Express backend + Vite HMR on port 3000)
npm run dev

# Build for Production (Bundles Vite frontend & esbuild CommonJS server.cjs)
npm run build

# Start Production Server
npm run start
```
