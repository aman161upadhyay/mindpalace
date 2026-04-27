# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Mind Palace landing page with two luxurious, editorial variants (A and B) featuring a simultaneous bidirectional typing animation, marginalia quote cards, an animated daily-sparks email preview, and a Contact page.

**Architecture:** Approach A (`/`) is text-dominant with centered layout and staggered quote cards. Approach B (`/home-b`) uses a split hero with a moss green orb. Both share a nav, footer, and CSS animation foundation defined in `index.css`. A new `Contact` page lives at `/contact`.

**Tech Stack:** React 19, TailwindCSS v4, Wouter routing, Lucide React icons, Playfair Display + Inter + JetBrains Mono (already loaded via Google Fonts in index.css).

> **Note on TDD:** This plan produces UI-only pages with no business logic. The project has no UI testing setup (existing 16 tests cover API handlers via Vitest). Verification is visual: `npm run dev` → `localhost:5173`. No new test files needed.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/index.css` | Modify | Add `@keyframes cursor-blink`, `@keyframes scroll-up`, `.landing-glow` utility |
| `src/App.tsx` | Modify | Add `/home-b` and `/contact` routes |
| `src/pages/Contact.tsx` | Create | Contact page with Aman's details |
| `src/pages/Home.tsx` | Replace | Approach A — editorial minimal landing page |
| `src/pages/HomeB.tsx` | Create | Approach B — split composition landing page |

---

## Task 1: CSS Keyframes + Routing

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add keyframes and landing utilities to index.css**

Open `src/index.css`. Append the following before the final closing brace / after the existing `@layer components` block:

```css
/* ─── Landing Page Animations ─── */
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes scroll-up {
  0%   { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}

/* Moss green radial glow — used in dark mode hero */
.landing-glow {
  position: absolute;
  width: 640px;
  height: 640px;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(78, 106, 87, 0.18) 0%, transparent 70%);
  filter: blur(60px);
  pointer-events: none;
}

/* Light-mode glow is subtler */
[data-theme="light"] .landing-glow {
  background: radial-gradient(circle, rgba(46, 64, 54, 0.08) 0%, transparent 70%);
}
```

- [ ] **Step 2: Add routes to App.tsx**

Replace the content of `src/App.tsx` with:

```tsx
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Home from "./pages/Home";
import HomeB from "./pages/HomeB";
import Contact from "./pages/Contact";
import MindPalace from "./pages/MindPalace";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/home-b" component={HomeB} />
      <Route path="/contact" component={Contact} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/mind-palace">
        <ProtectedRoute component={MindPalace} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
```

- [ ] **Step 3: Verify the app still compiles**

```bash
cd "M:/AI/Knowledge_Area51"
npm run dev
```

Expected: Vite starts on `localhost:5173`, no TypeScript errors. `/home-b` and `/contact` will 404 until we create those files — that's fine.

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/App.tsx
git commit -m "feat: add landing page CSS keyframes and /home-b, /contact routes"
```

---

## Task 2: Contact Page

**Files:**
- Create: `src/pages/Contact.tsx`

- [ ] **Step 1: Create Contact.tsx**

Create `src/pages/Contact.tsx` with the following content:

```tsx
import { useLocation } from "wouter";
import { ArrowLeft, Mail, Linkedin, MessageCircle } from "lucide-react";

export default function Contact() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="noise-overlay" />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Mind Palace
        </button>
      </nav>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-6 pt-24 pb-16 relative overflow-hidden">
        {/* Glow — positioned relative to this section */}
        <div className="landing-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" />

        <div className="w-full max-w-sm relative z-10">

          {/* Card */}
          <div className="relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-8 shadow-xl">

            {/* Label */}
            <p
              className="text-xs uppercase tracking-widest text-primary mb-6"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              Builder · Founder · Thinker
            </p>

            {/* Name */}
            <h1
              className="text-3xl font-bold text-foreground mb-3"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Aman Upadhyay
            </h1>

            {/* Bio */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-1">
              AI builder at the intersection of Business and Technology.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              SME in ML/AI and Data Science. 2x Founder. MBA Candidate 2027, Harvard Business School.
            </p>

            {/* Divider */}
            <div className="w-8 h-px bg-primary/40 mb-8" />

            {/* Links */}
            <div className="flex flex-col gap-4">
              <a
                href="mailto:aupadhyay@mba2027.hbs.edu"
                className="flex items-center gap-3 text-sm text-foreground/80 hover:text-primary transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                aupadhyay@mba2027.hbs.edu
              </a>

              <a
                href="https://www.linkedin.com/in/amanupadhyay/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-foreground/80 hover:text-primary transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Linkedin className="w-4 h-4 text-primary" />
                </div>
                linkedin.com/in/amanupadhyay
              </a>

              <a
                href="https://wa.me/13128267339"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-foreground/80 hover:text-primary transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <MessageCircle className="w-4 h-4 text-primary" />
                </div>
                WhatsApp · +1 312 826 7339
              </a>
            </div>
          </div>

          {/* Footer line */}
          <p
            className="text-center text-xs text-muted-foreground/50 mt-8"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            Mind Palace · Your marginalia, forever.
          </p>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify Contact page**

With `npm run dev` running, navigate to `http://localhost:5173/contact`.

Expected:
- Fixed nav with back arrow
- Centered card with name, bio, 3 links (email, LinkedIn, WhatsApp)
- Moss green hover states on links
- Dark/light theme respects existing theme toggle

- [ ] **Step 3: Commit**

```bash
git add src/pages/Contact.tsx
git commit -m "feat: add Contact page with Aman Upadhyay details"
```

---

## Task 3: Home A — Nav + Hero with Typing Animation

**Files:**
- Replace: `src/pages/Home.tsx`

The typing animation runs on mount. Line 1 grows rightward (cursor fixed at left). Line 2 grows leftward (cursor fixed at right, text right-aligned). Both animate simultaneously at 38ms/character.

- [ ] **Step 1: Write the shared nav component inline and the typing hook**

Replace the entire `src/pages/Home.tsx` with the shell + nav + hero. We'll add remaining sections in Task 4.

```tsx
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowRight, Leaf } from "lucide-react";

const LINE1 = "Every idea you've ever read,";
const LINE2 = "remembered in one place.";

function useTypingAnimation() {
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    let j = 0;
    const timer = setInterval(() => {
      let active = false;
      if (i < LINE1.length) {
        i++;
        setText1(LINE1.slice(0, i));
        active = true;
      }
      if (j < LINE2.length) {
        j++;
        // Build from the right end: slice last j characters
        setText2(LINE2.slice(LINE2.length - j));
        active = true;
      }
      if (!active) {
        clearInterval(timer);
        setDone(true);
      }
    }, 38);
    return () => clearInterval(timer);
  }, []);

  return { text1, text2, done };
}

function LandingNav() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2.5 group"
      >
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
          <Leaf className="w-3.5 h-3.5 text-primary" />
        </div>
        <span
          className="text-foreground font-semibold tracking-tight group-hover:text-primary transition-colors"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          Mind Palace
        </span>
      </button>

      <div className="flex items-center gap-6">
        <button
          onClick={() => navigate("/contact")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Contact
        </button>
        {isAuthenticated ? (
          <Button
            size="sm"
            onClick={() => navigate("/mind-palace")}
            className="rounded-full px-5 h-8 text-xs"
          >
            Open Mind Palace
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => navigate("/register")}
            className="rounded-full px-5 h-8 text-xs"
          >
            Create Account
          </Button>
        )}
      </div>
    </nav>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { text1, text2, done } = useTypingAnimation();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <div className="noise-overlay" />
      <LandingNav />

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center overflow-hidden">

        {/* Radial glow — moss green, strongest in dark mode */}
        <div className="landing-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

        {/* Thin top rule */}
        <div className="relative z-10 w-16 h-px bg-primary/40 mb-12" />

        {/* Typing animation */}
        <div className="relative z-10 mb-10 w-full max-w-2xl">
          {/* Line 1: cursor fixed at left, text grows right */}
          <div className="flex items-center justify-start gap-2 mb-3">
            <span
              className="w-0.5 h-10 md:h-14 bg-primary shrink-0"
              style={{ animation: "cursor-blink 0.8s ease-in-out infinite" }}
            />
            <span
              className="text-4xl md:text-6xl font-bold text-foreground leading-none text-left"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              {text1}
            </span>
          </div>

          {/* Line 2: cursor fixed at right, text grows left, right-aligned */}
          <div className="flex items-center justify-end gap-2 pl-8">
            <span
              className="text-4xl md:text-6xl font-bold text-muted-foreground leading-none text-right"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              {text2}
            </span>
            <span
              className="w-0.5 h-10 md:h-14 bg-primary/60 shrink-0"
              style={{ animation: "cursor-blink 0.8s ease-in-out infinite 0.4s" }}
            />
          </div>
        </div>

        {/* Subline — fades in after animation completes */}
        <p
          className="relative z-10 text-xs uppercase tracking-widest text-primary/70 mb-12 transition-opacity duration-700"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            opacity: done ? 1 : 0,
          }}
        >
          Capture marginalia · Collect sparks · Build your relics
        </p>

        {/* CTA */}
        <div
          className="relative z-10 transition-opacity duration-700"
          style={{ opacity: done ? 1 : 0 }}
        >
          {isAuthenticated ? (
            <Button
              size="lg"
              onClick={() => navigate("/mind-palace")}
              className="rounded-full px-10 h-12 gap-2 shadow-lg shadow-primary/10"
            >
              Open Mind Palace <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => navigate("/register")}
              className="rounded-full px-10 h-12 gap-2 shadow-lg shadow-primary/10"
            >
              Create Account <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>

      {/* Sparks and Daily 5 sections — added in Task 4 */}
    </div>
  );
}
```

- [ ] **Step 2: Verify hero renders**

With `npm run dev` running, open `http://localhost:5173`.

Expected:
- Fixed nav: Leaf icon + "Mind Palace" left, "Contact" + "Create Account" right
- Hero: two lines type simultaneously — line 1 from left, line 2 from right
- After animation: subline fades in, then CTA button fades in
- No console errors

- [ ] **Step 3: Commit hero shell**

```bash
git add src/pages/Home.tsx
git commit -m "feat: Home A — nav + hero with bidirectional typing animation"
```

---

## Task 4: Home A — Sparks Section + Daily 5 + Footer

**Files:**
- Modify: `src/pages/Home.tsx` (add three sections below the hero)

- [ ] **Step 1: Define the sparks and email data constants**

At the top of `src/pages/Home.tsx`, after the existing imports and before `useTypingAnimation`, add these constants:

```tsx
const SPARKS = [
  {
    quote: "Success brings an asymmetry, you now have more to lose than to gain. You are hence fragile.",
    author: "Nassim N. Taleb",
    label: "spark",
  },
  {
    quote:
      "LLMs are structurally biased toward action. Due to RLHF, they are \"eager to please\" and will rush to generate artifacts before mapping the full design tree.",
    author: "Gemini Chat",
    label: "marginalia",
  },
  {
    quote: "You are not a drop in the ocean. You are the entire ocean in a drop.",
    author: "Rumi",
    label: "relic",
  },
];

const EMAIL_SPARKS = [
  {
    text: "The MCP is an open protocol designed specifically to bridge the critical gap between isolated, generalized AI models and highly dynamic, real-world, proprietary data environments...",
    source: "Planhat",
  },
  {
    text: "It is true that intrinsic valuation, at least in its discounted cash flow avatar, is much easier to do at companies that have many years of historical data...",
    source: "Damodaran",
  },
  {
    text: "Since the simulation is centered on the same expected values, it should come as no surprise that the median value across ten thousand simulations of $1.29 trillion is close to the base case...",
    source: "Damodaran",
  },
  {
    text: "Existential nihilism asserts that life has no objective meaning or purpose. The idea that all values are ultimately pointless has been associated with various responses...",
    source: "",
  },
  {
    text: "Before World War I, Europe had a naturally integrated capital market. An investor in London could easily finance a railway in the Balkans or an industrial plant in Germany...",
    source: "",
  },
];
```

- [ ] **Step 2: Replace the Home component's return to include all sections**

Replace the entire `export default function Home()` in `src/pages/Home.tsx` with the complete version below:

```tsx
export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { text1, text2, done } = useTypingAnimation();

  // Duplicate email sparks for seamless loop
  const loopSparks = [...EMAIL_SPARKS, ...EMAIL_SPARKS];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <div className="noise-overlay" />
      <LandingNav />

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center overflow-hidden">
        <div className="landing-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

        <div className="relative z-10 w-16 h-px bg-primary/40 mb-12" />

        {/* Typing animation */}
        <div className="relative z-10 mb-10 w-full max-w-2xl">
          <div className="flex items-center justify-start gap-2 mb-3">
            <span
              className="w-0.5 h-10 md:h-14 bg-primary shrink-0"
              style={{ animation: "cursor-blink 0.8s ease-in-out infinite" }}
            />
            <span
              className="text-4xl md:text-6xl font-bold text-foreground leading-none text-left"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              {text1}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2 pl-8">
            <span
              className="text-4xl md:text-6xl font-bold text-muted-foreground leading-none text-right"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              {text2}
            </span>
            <span
              className="w-0.5 h-10 md:h-14 bg-primary/60 shrink-0"
              style={{ animation: "cursor-blink 0.8s ease-in-out infinite 0.4s" }}
            />
          </div>
        </div>

        <p
          className="relative z-10 text-xs uppercase tracking-widest text-primary/70 mb-12 transition-opacity duration-700"
          style={{ fontFamily: '"JetBrains Mono", monospace', opacity: done ? 1 : 0 }}
        >
          Capture marginalia · Collect sparks · Build your relics
        </p>

        <div className="relative z-10 transition-opacity duration-700" style={{ opacity: done ? 1 : 0 }}>
          {isAuthenticated ? (
            <Button size="lg" onClick={() => navigate("/mind-palace")} className="rounded-full px-10 h-12 gap-2 shadow-lg shadow-primary/10">
              Open Mind Palace <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button size="lg" onClick={() => navigate("/register")} className="rounded-full px-10 h-12 gap-2 shadow-lg shadow-primary/10">
              Create Account <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>

      {/* ── SPARKS ── */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto">

          {/* Section header */}
          <div className="text-center mb-20">
            <p
              className="text-xs uppercase tracking-widest text-primary/60 mb-4"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              From curious minds
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold text-foreground"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Ideas worth keeping.
            </h2>
          </div>

          {/* Staggered rotated cards */}
          <div className="flex flex-col items-center gap-8">
            {SPARKS.map((spark, i) => {
              const rotations = [-2, 1.5, -1];
              const offsets = ["self-start", "self-center", "self-end"];
              return (
                <div
                  key={i}
                  className={`w-full max-w-md ${offsets[i]} rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-7 shadow-lg`}
                  style={{ transform: `rotate(${rotations[i]}deg)` }}
                >
                  {/* Label pill */}
                  <span
                    className="inline-block text-[10px] uppercase tracking-widest text-primary border border-primary/30 rounded-full px-2.5 py-0.5 mb-5"
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  >
                    {spark.label}
                  </span>

                  {/* Quote */}
                  <p
                    className="text-base text-foreground leading-relaxed mb-5"
                    style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                  >
                    &ldquo;
                    <span className="underline decoration-primary decoration-2 underline-offset-3">
                      {spark.quote}
                    </span>
                    &rdquo;
                  </p>

                  {/* Author */}
                  <p
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  >
                    — {spark.author}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── DAILY 5 ── */}
      <section className="py-24 px-6 bg-[#1a2e22]">
        <div className="max-w-lg mx-auto text-center">

          {/* Heading */}
          <p
            className="text-xs uppercase tracking-widest text-primary/70 mb-4"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            Daily delivery
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold text-white mb-4"
            style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
          >
            5 sparks. Every morning.
          </h2>
          <p className="text-sm text-white/50 mb-12 leading-relaxed">
            Your relics, revisited daily. A gentle nudge from your past self.
          </p>

          {/* Email card */}
          <div className="rounded-2xl bg-white shadow-2xl overflow-hidden mx-auto max-w-xs">
            {/* Card header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p
                  className="text-[10px] uppercase tracking-widest text-gray-400"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  Mind Palace
                </p>
                <p className="text-xs font-semibold text-gray-800 mt-0.5">Daily Sparks</p>
              </div>
              <div className="w-6 h-6 rounded-full bg-[#4e6a57]/15 flex items-center justify-center">
                <Leaf className="w-3 h-3 text-[#4e6a57]" />
              </div>
            </div>

            {/* Scrolling sparks */}
            <div className="overflow-hidden h-48 px-5 py-3">
              <div style={{ animation: "scroll-up 14s linear infinite" }}>
                {loopSparks.map((s, i) => (
                  <div key={i} className="py-3 border-b border-gray-100 last:border-0">
                    <p className="text-xs text-gray-700 leading-relaxed line-clamp-2 text-left">
                      {s.text}
                    </p>
                    {s.source && (
                      <p
                        className="text-[10px] text-[#4e6a57] mt-1 text-left"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        {s.source}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-4 mt-10">
            {["✦ 5 random marginalia", "✦ Privacy first", "✦ Unsubscribe anytime"].map((pill) => (
              <span
                key={pill}
                className="text-xs text-white/40"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 px-6 border-t border-border/40">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-primary" />
            <span
              className="text-sm font-semibold text-foreground"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Mind Palace
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <button onClick={() => navigate("/contact")} className="hover:text-foreground transition-colors">
              Contact
            </button>
            <button onClick={() => navigate("/login")} className="hover:text-foreground transition-colors">
              Sign in
            </button>
          </div>
          <p
            className="text-xs text-muted-foreground/40"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            Your marginalia, forever.
          </p>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Verify full Home A**

Open `http://localhost:5173`.

Expected:
- Hero: typing animation + subline + CTA
- Scroll down: 3 staggered rotated quote cards with moss green pill labels and underlines
- Scroll further: dark green `#1a2e22` section with animated email card, 5 sparks scrolling upward in a loop
- Footer: Leaf icon, Contact + Sign in links, tagline

- [ ] **Step 4: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat: Home A — sparks cards, daily-5 email animation, footer"
```

---

## Task 5: Home B — Split Composition

**Files:**
- Create: `src/pages/HomeB.tsx`

Home B shares the same `SPARKS`, `EMAIL_SPARKS`, `LandingNav`, and `useTypingAnimation` logic but uses a split hero (left text / right orb) and a 3-column grid for sparks.

- [ ] **Step 1: Create HomeB.tsx**

Create `src/pages/HomeB.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowRight, Leaf } from "lucide-react";

const LINE1 = "Every idea you've ever read,";
const LINE2 = "remembered in one place.";

const SPARKS = [
  {
    quote: "Success brings an asymmetry, you now have more to lose than to gain. You are hence fragile.",
    author: "Nassim N. Taleb",
    label: "spark",
  },
  {
    quote:
      "LLMs are structurally biased toward action. Due to RLHF, they are \"eager to please\" and will rush to generate artifacts before mapping the full design tree.",
    author: "Gemini Chat",
    label: "marginalia",
  },
  {
    quote: "You are not a drop in the ocean. You are the entire ocean in a drop.",
    author: "Rumi",
    label: "relic",
  },
];

const EMAIL_SPARKS = [
  {
    text: "The MCP is an open protocol designed specifically to bridge the critical gap between isolated, generalized AI models and highly dynamic, real-world, proprietary data environments...",
    source: "Planhat",
  },
  {
    text: "It is true that intrinsic valuation, at least in its discounted cash flow avatar, is much easier to do at companies that have many years of historical data...",
    source: "Damodaran",
  },
  {
    text: "Since the simulation is centered on the same expected values, it should come as no surprise that the median value across ten thousand simulations of $1.29 trillion is close to the base case...",
    source: "Damodaran",
  },
  {
    text: "Existential nihilism asserts that life has no objective meaning or purpose. The idea that all values are ultimately pointless has been associated with various responses...",
    source: "",
  },
  {
    text: "Before World War I, Europe had a naturally integrated capital market. An investor in London could easily finance a railway in the Balkans or an industrial plant in Germany...",
    source: "",
  },
];

function useTypingAnimation() {
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    let j = 0;
    const timer = setInterval(() => {
      let active = false;
      if (i < LINE1.length) { i++; setText1(LINE1.slice(0, i)); active = true; }
      if (j < LINE2.length) { j++; setText2(LINE2.slice(LINE2.length - j)); active = true; }
      if (!active) { clearInterval(timer); setDone(true); }
    }, 38);
    return () => clearInterval(timer);
  }, []);

  return { text1, text2, done };
}

export default function HomeB() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { text1, text2, done } = useTypingAnimation();
  const loopSparks = [...EMAIL_SPARKS, ...EMAIL_SPARKS];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <div className="noise-overlay" />

      {/* ── NAV (identical to Home A) ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
            <Leaf className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-foreground font-semibold tracking-tight group-hover:text-primary transition-colors" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
            Mind Palace
          </span>
        </button>
        <div className="flex items-center gap-6">
          <button onClick={() => navigate("/contact")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Contact
          </button>
          {isAuthenticated ? (
            <Button size="sm" onClick={() => navigate("/mind-palace")} className="rounded-full px-5 h-8 text-xs">
              Open Mind Palace
            </Button>
          ) : (
            <Button size="sm" onClick={() => navigate("/register")} className="rounded-full px-5 h-8 text-xs">
              Create Account
            </Button>
          )}
        </div>
      </nav>

      {/* ── HERO (split layout) ── */}
      <section className="relative min-h-screen flex items-center px-8 md:px-16 pt-24 pb-16 overflow-hidden">

        {/* Left: text */}
        <div className="relative z-10 flex-1 max-w-xl">
          <div className="w-10 h-px bg-primary/40 mb-10" />

          {/* Typing animation — left aligned */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-0.5 h-10 md:h-12 bg-primary shrink-0"
                style={{ animation: "cursor-blink 0.8s ease-in-out infinite" }}
              />
              <span
                className="text-3xl md:text-5xl font-bold text-foreground leading-tight"
                style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
              >
                {text1}
              </span>
            </div>
            <div className="flex items-center gap-2 pl-6">
              <span
                className="text-3xl md:text-5xl font-bold text-muted-foreground leading-tight"
                style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
              >
                {text2}
              </span>
              <span
                className="w-0.5 h-10 md:h-12 bg-primary/60 shrink-0"
                style={{ animation: "cursor-blink 0.8s ease-in-out infinite 0.4s" }}
              />
            </div>
          </div>

          <p
            className="text-sm text-muted-foreground mb-8 leading-relaxed transition-opacity duration-700"
            style={{ opacity: done ? 1 : 0 }}
          >
            The next 50 years of what you read, in one place.
          </p>

          <div className="transition-opacity duration-700" style={{ opacity: done ? 1 : 0 }}>
            {isAuthenticated ? (
              <Button size="lg" onClick={() => navigate("/mind-palace")} className="rounded-full px-10 h-12 gap-2 shadow-lg shadow-primary/10">
                Open Mind Palace <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button size="lg" onClick={() => navigate("/register")} className="rounded-full px-10 h-12 gap-2 shadow-lg shadow-primary/10">
                Create Account <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Right: moss green orb + floating quote */}
        <div className="hidden md:flex flex-1 items-center justify-center relative h-[500px]">
          {/* Orb */}
          <div className="w-80 h-80 rounded-full bg-primary/20 blur-3xl absolute" />
          {/* Floating quote fragment — fades in after animation */}
          <div
            className="relative text-center px-10 transition-opacity duration-1000"
            style={{ opacity: done ? 1 : 0 }}
          >
            <p
              className="text-primary/80 text-base leading-relaxed italic"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              &ldquo;remembered in one place.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* ── SPARKS (3-column grid) ── */}
      <section className="py-24 px-6 md:px-16">
        <div className="max-w-5xl mx-auto">
          <div className="mb-14">
            <p
              className="text-xs uppercase tracking-widest text-primary/60 mb-3"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              From curious minds
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold text-foreground"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Ideas worth keeping.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SPARKS.map((spark, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-6 shadow-md"
              >
                <span
                  className="inline-block text-[10px] uppercase tracking-widest text-primary border border-primary/30 rounded-full px-2.5 py-0.5 mb-5"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  {spark.label}
                </span>
                <p
                  className="text-sm text-foreground leading-relaxed mb-4"
                  style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                >
                  &ldquo;
                  <span className="underline decoration-primary decoration-2 underline-offset-3">
                    {spark.quote}
                  </span>
                  &rdquo;
                </p>
                <p
                  className="text-xs text-muted-foreground"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  — {spark.author}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DAILY 5 (lighter background, same email animation) ── */}
      <section className="py-24 px-6 md:px-16">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-16">

          {/* Left: copy */}
          <div className="flex-1">
            <p
              className="text-xs uppercase tracking-widest text-primary/60 mb-4"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              Daily delivery
            </p>
            <h2
              className="text-3xl font-bold text-foreground mb-4"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              5 sparks.<br />Every morning.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              Your relics, revisited daily. A gentle nudge from your past self.
            </p>
            <div className="flex flex-col gap-2">
              {["✦ 5 random marginalia", "✦ Privacy first", "✦ Unsubscribe anytime"].map((pill) => (
                <span
                  key={pill}
                  className="text-xs text-muted-foreground/60"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>

          {/* Right: email card */}
          <div className="flex-1 flex justify-center">
            <div className="rounded-2xl bg-card border border-border/60 shadow-xl overflow-hidden w-72">
              <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    Mind Palace
                  </p>
                  <p className="text-xs font-semibold text-foreground mt-0.5">Daily Sparks</p>
                </div>
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                  <Leaf className="w-3 h-3 text-primary" />
                </div>
              </div>
              <div className="overflow-hidden h-48 px-5 py-3">
                <div style={{ animation: "scroll-up 14s linear infinite" }}>
                  {loopSparks.map((s, i) => (
                    <div key={i} className="py-3 border-b border-border/30 last:border-0">
                      <p className="text-xs text-foreground/70 leading-relaxed line-clamp-2 text-left">{s.text}</p>
                      {s.source && (
                        <p className="text-[10px] text-primary mt-1 text-left" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                          {s.source}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 px-6 border-t border-border/40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
              Mind Palace
            </span>
          </div>
          <p className="text-xs text-muted-foreground/40" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            Your marginalia, forever.
          </p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <button onClick={() => navigate("/contact")} className="hover:text-foreground transition-colors">Contact</button>
            <button onClick={() => navigate("/login")} className="hover:text-foreground transition-colors">Sign in</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify Home B**

Navigate to `http://localhost:5173/home-b`.

Expected:
- Split hero: typing animation left, moss green orb right (hidden on small screens)
- After animation: subline + CTA fades in, floating quote appears in orb
- 3-column sparks grid (no tilt)
- Daily 5 section: side-by-side copy + email card (no dark green block — uses `bg-background`)
- Two-column footer

- [ ] **Step 3: Commit**

```bash
git add src/pages/HomeB.tsx
git commit -m "feat: Home B — split hero, grid sparks, inline daily-5 section"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Check all routes**

With `npm run dev` running:

| URL | Expected |
|-----|----------|
| `localhost:5173/` | Home A — centered editorial |
| `localhost:5173/home-b` | Home B — split layout |
| `localhost:5173/contact` | Contact card with email/LinkedIn/WhatsApp |
| `localhost:5173/login` | Existing login page (unchanged) |
| `localhost:5173/mind-palace` | Redirects to `/login` if not authenticated |

- [ ] **Step 2: Test theme switching**

Toggle between light and dark themes (via Settings or ThemeContext). Verify:
- Light: off-white `#eae6df` background, deep moss green `#2e4036` primary
- Dark: near-black `#111312` background, moss `#4e6a57` primary, glow visible in hero
- Email card on Home A: always white (hardcoded `bg-white`) — correct, it represents a real email
- Email card on Home B: uses `bg-card` — adapts to theme

- [ ] **Step 3: Verify typing animation**

Hard-refresh `localhost:5173`. Confirm:
- Both lines start simultaneously
- Line 1 grows rightward from the left cursor
- Line 2 grows leftward from the right cursor
- Subline and CTA fade in after both lines complete
- No jitter or flicker

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: landing page redesign complete — Home A, Home B, Contact"
```
