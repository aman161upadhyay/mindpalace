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
      'LLMs are structurally biased toward action. Due to RLHF, they are "eager to please" and will rush to generate artifacts before mapping the full design tree.',
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

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5 group">
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

          <div className="mb-8">
            {/* Line 1: cursor at left, text grows right */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-0.5 h-8 md:h-10 bg-primary shrink-0"
                style={{ animation: "cursor-blink 0.8s ease-in-out infinite" }}
              />
              <span
                className="text-2xl md:text-4xl font-bold text-foreground leading-none whitespace-nowrap"
                style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
              >
                {text1}
              </span>
            </div>
            {/* Line 2: cursor at right, text grows left */}
            <div className="flex items-center gap-2">
              <span
                className="text-2xl md:text-4xl font-bold text-muted-foreground leading-none whitespace-nowrap"
                style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
              >
                {text2}
              </span>
              <span
                className="w-0.5 h-8 md:h-10 bg-primary/60 shrink-0"
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
          <div className="w-80 h-80 rounded-full bg-primary/20 blur-3xl absolute" />
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
                className="rounded-2xl border border-[#e8dfc8] p-6 shadow-md"
                style={{ backgroundColor: "#f5f0e3" }}
              >
                <span
                  className="inline-block text-[10px] uppercase tracking-widest border rounded-full px-2.5 py-0.5 mb-5"
                  style={{ fontFamily: '"JetBrains Mono", monospace', color: "#4e6a57", borderColor: "#4e6a5750" }}
                >
                  {spark.label}
                </span>
                <p
                  className="text-sm leading-relaxed mb-4"
                  style={{ fontFamily: '"IM Fell English", Georgia, serif', color: "#1c1b1a" }}
                >
                  &ldquo;
                  <span className="underline decoration-2 underline-offset-3" style={{ textDecorationColor: "#4e6a57" }}>
                    {spark.quote}
                  </span>
                  &rdquo;
                </p>
                <p
                  className="text-xs"
                  style={{ fontFamily: '"JetBrains Mono", monospace', color: "#7a6f5e" }}
                >
                  — {spark.author}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DAILY 5 (lighter background) ── */}
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

          {/* Right: email card — uses bg-card (theme-adaptive) */}
          <div className="flex-1 flex justify-center">
            <div className="rounded-2xl bg-card border border-border/60 shadow-xl overflow-hidden w-72">
              <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                <div>
                  <p
                    className="text-[10px] uppercase tracking-widest text-muted-foreground"
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  >
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
                      <p className="text-xs text-foreground/70 leading-relaxed line-clamp-2 text-left">
                        {s.text}
                      </p>
                      {s.source && (
                        <p
                          className="text-[10px] text-primary mt-1 text-left"
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
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 px-6 border-t border-border/40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-primary" />
            <span
              className="text-sm font-semibold text-foreground"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Mind Palace
            </span>
          </div>
          <p
            className="text-xs text-muted-foreground/40"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            Your marginalia, forever.
          </p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <button onClick={() => navigate("/contact")} className="hover:text-foreground transition-colors">
              Contact
            </button>
            <button onClick={() => navigate("/login")} className="hover:text-foreground transition-colors">
              Sign in
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
