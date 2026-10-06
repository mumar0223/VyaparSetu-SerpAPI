<div align="center">

#  VyaparSetu — व्यापार सेतु

### AI Hyper-Local Research & Voice Intelligence Swarm for India's MSMEs

*A multi-agent business advisor that grounds every answer in **live Google data via SerpApi** — mandi rates, nearby competitors, govt schemes, and loan rates — in the language and context of the Indian small business owner.*

<br/>

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-vyapar--setu--serp--api.vercel.app-10b981?style=for-the-badge)](https://vyapar-setu-serp-api.vercel.app)
[![SerpApi](https://img.shields.io/badge/Powered_by-SerpApi-2563eb?style=for-the-badge)](https://serpapi.com)
[![Hackathon](https://img.shields.io/badge/SerpApi-India_Hackathon_2026-f59e0b?style=for-the-badge)](https://serpapi.com/indiahackathon)

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=flat-square&logo=googlegemini&logoColor=white)

</div>

---

##  Table of Contents

- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [Features](#-features)
- [How SerpApi Powers VyaparSetu](#-how-serpapi-powers-vyaparsetu)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Screenshots](#-screenshots)
- [Roadmap](#-roadmap)
- [Team](#-team)
- [License](#-license)

---

##  The Problem

India has **60+ million MSMEs**, and most of them run on gut feeling, paper ledgers, and word of mouth. A kirana owner or a small trader typically:

- **Can't see today's mandi prices** or what a rival two lanes away is charging
- **Doesn't know** which government schemes (PM Mudra, SVANidhi, CGTMSE) they already qualify for
- **Pays 25% commissions** to legacy platforms because they don't know cheaper channels like ONDC exist
- **Has no formal credit history**, so banks can't see the cash-flow health that's right there in their daily UPI receipts

Generic chatbots hallucinate on exactly these questions. The answers change daily, vary by pincode, and live scattered across the web.

##  The Solution

**VyaparSetu** ("business bridge") is an autonomous swarm of AI agents that **researches the live web through SerpApi** before it answers — then turns what it finds into practical, local, bank-ready advice. Owners can talk to it by **voice** (Gemini Live), show it things through the **camera**, and operate in their own language.

>  **Grounded, not guessed.** Every market, scheme, and rate insight is backed by real-time search results.

---

##  Features

| | Feature | What it does |
|---|---|---|
| 🏪 | **Hyper-Local Competitor Radar** | Scans nearby rival businesses, their prices, and assigns threat ratings |
| 🌾 | **Live APMC Mandi Rates** | Current onion, wheat, and commodity arrivals plus arbitrage opportunities |
| 🛒 | **ONDC Sourcing & Selling** | Finds B2B wholesale sourcing 8–12% cheaper, and selling at ~3% commission vs ~25% on legacy apps |
| 🏛️ | **Govt Scheme Advisor** | Checks zero-collateral credit eligibility for PM Mudra, SVANidhi, CGTMSE and more |
| 💳 | **Alternative Credit Profile** | Cash-flow-based score from ledger activity, UPI turnover, expense discipline, GST/Udyam compliance, and DSCR — with a downloadable credit dossier |
| 🎚️ | **Score Boost Simulator** | Toggle compliance habits (file GSTIN, log UPI receipts, keep DSCR > 2×) and preview your projected score |
| 🧮 | **Loan & EMI Simulator** | Live EMI, total interest, amortization schedule, and DSCR affordability check, alongside **live bank rates researched via SerpApi** |
| 📊 | **Enterprise Hub** | Cash-flow trajectory, expense breakdown, working-capital buffer, SWOT radar, and a one-click **360° AI Swarm Analysis** |
| 🎙️ | **Voice Agent OS** | Hands-free conversation with Gemini Live voice and camera vision |
| 🌐 | **Multilingual UI** | Language switcher with Hindi labels throughout (व्यापार हब, क्रेडिट, ईएमआई) |
| 📴 | **Local-first data** | Client-side storage via Dexie (IndexedDB) for fast, resilient profile and chat history |

---

##  How SerpApi Powers VyaparSetu

SerpApi is the **grounding layer** of the whole system. Instead of relying on a model's stale training data, agents call SerpApi to fetch fresh, structured results and reason over them.

| Use case | Why live data matters |
|---|---|
| **Competitor scan** | Local business listings and pricing change weekly |
| **Mandi rates** | Commodity prices move daily |
| **Bank loan rates** | Rates and subsidies are revised often and differ by lender |
| **Scheme discovery** | Eligibility rules and portals are updated by govt notifications |
| **ONDC sourcing** | Supplier and pricing availability is regional |

```
Owner's question ──▶ Router agent ──▶ Specialist agent(s) ──▶ SerpApi (live search)
                                              │                      │
                                              ◀──── structured results
                                              │
                                    Grounded, local, actionable answer
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Next.js 16 (App Router)                 │
│  ┌────────────┐  ┌────────────┐  ┌─────────┐  ┌───────────┐  │
│  │ Chat / AI  │  │ Enterprise │  │ Credit  │  │ EMI Sim   │  │
│  │ Voice OS   │  │ Hub        │  │ Profile │  │           │  │
│  └─────┬──────┘  └─────┬──────┘  └────┬────┘  └─────┬─────┘  │
│        └───────────────┴──────────────┴─────────────┘        │
│                          │  API routes / server logic        │
└──────────────────────────┼───────────────────────────────────┘
           ┌───────────────┼─────────────────┬──────────────────┐
           ▼               ▼                 ▼                  ▼
     ┌──────────┐   ┌─────────────┐   ┌────────────┐    ┌────────────┐
     │ SerpApi  │   │ Gemini /    │   │ PostgreSQL │    │ Dexie      │
     │ live web │   │ Vertex / AI │   │ via Prisma │    │ (browser)  │
     │ grounding│   │ SDK models  │   │            │    │            │
     └──────────┘   └─────────────┘   └────────────┘    └────────────┘
```

---

##  Tech Stack

**Frontend**
- [Next.js 16](https://nextjs.org) · [React 19](https://react.dev) · TypeScript
- Tailwind CSS 4 · shadcn/ui · Base UI · `lucide-react`
- Animation: `motion`, `gsap`, `tw-animate-css`
- Data viz: `recharts` · Maps: `leaflet`
- Rich content: `react-markdown`, `remark-gfm`, `remark-math` / `rehype-katex`, `mermaid`
- Utilities: `sonner`, `cmdk`, `embla-carousel-react`, `next-themes`

**AI & Search**
- **SerpApi** — real-time search grounding
- **Vercel AI SDK** (`ai`) with `@ai-sdk/google-vertex` and `@ai-sdk/openai`
- **Google Gemini** (`@google/genai`) — Live voice & camera vision

**Data & Auth**
- **Prisma 7** + **PostgreSQL** (`@prisma/adapter-pg`, `pg`)
- **Dexie** (IndexedDB) for local-first state
- **WebAuthn / passkeys** via `@simplewebauthn`
- **UploadThing** for file uploads

**Tooling:** ESLint 9 · PostCSS · Vercel (deployment)

---

##  Project Structure

```
VyaparSetu-SerpAPI/
├── app/                  # Next.js App Router — pages (/, /enterprise, /credit, /emi) & API routes
├── components/           # Reusable UI and feature components
├── hooks/                # Custom React hooks
├── lib/                  # Shared utilities, clients, and helpers
├── eslint.config.mjs
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

---

##  Getting Started

### Prerequisites

- **Node.js** 20+ and **npm**
- A **SerpApi** key — [sign up free](https://serpapi.com) (no credit card needed)
- A **Google Gemini / Vertex AI** key
- A **PostgreSQL** database (local, Neon, Supabase, etc.)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/mumar0223/VyaparSetu-SerpAPI.git
cd VyaparSetu-SerpAPI

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local     # then fill in your keys (see below)

# 4. Set up the database
npx prisma generate
npx prisma migrate dev

# 5. Run the dev server
npm run dev
```

Open **http://localhost:3000** 🎉

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Run the production build |
| `npm run lint` | Lint the codebase with ESLint |

---

##  Environment Variables

Create a `.env.local` file in the project root. **Variable names below are illustrative — match them to the names your code actually reads.**

```env
# SerpApi — live search grounding
SERPAPI_API_KEY=your_serpapi_key

# Google Gemini / Vertex AI
GOOGLE_API_KEY=your_gemini_key

# Database
DATABASE_URL=postgresql://user:password@host:5432/vyaparsetu

# UploadThing (if file uploads are enabled)
UPLOADTHING_TOKEN=your_uploadthing_token
```


---



##  Roadmap

- [ ] More regional languages for voice and UI
- [ ] WhatsApp-based interface for low-bandwidth users
- [ ] Direct GST / Udyam / Account Aggregator integrations for verified credit data
- [ ] Pincode-level price alerts for mandi and competitor changes
- [ ] Offline-first mode for rural connectivity
- [ ] Bank partner pre-qualification handoff

---


## ⚠️ Disclaimer

VyaparSetu is an AI assistant and **can make mistakes**. Always verify important financial and trade decisions with a qualified professional or the lender directly. Credit scores shown are illustrative and are **not** a CIBIL score.


<div align="center">

**Built with ❤️ in India, for India's small businesses.**

</div>
