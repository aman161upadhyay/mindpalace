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
      if (i < LINE1.length) {
        i++;
        setText1(LINE1.slice(0, i));
        active = true;
      }
      if (j < LINE2.length) {
        j++;
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
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { text1, text2, done } = useTypingAnimation();
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
        <div className="relative z-10 mb-10 w-full max-w-5xl">
          {/* Line 1: cursor fixed at left, text grows right */}
          <div className="flex items-center justify-start gap-2 mb-3">
            <span
              className="w-0.5 h-8 md:h-12 bg-primary shrink-0"
              style={{ animation: "cursor-blink 0.8s ease-in-out infinite" }}
            />
            <span
              className="text-3xl md:text-5xl font-bold text-foreground leading-none text-left whitespace-nowrap"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              {text1}
            </span>
          </div>

          {/* Line 2: cursor fixed at right, text grows left */}
          <div className="flex items-center justify-end gap-2">
            <span
              className="text-3xl md:text-5xl font-bold text-muted-foreground leading-none text-right whitespace-nowrap"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              {text2}
            </span>
            <span
              className="w-0.5 h-8 md:h-12 bg-primary/60 shrink-0"
              style={{ animation: "cursor-blink 0.8s ease-in-out infinite 0.4s" }}
            />
          </div>
        </div>

        <p
          className="relative z-10 text-xs uppercase tracking-widest text-primary/70 mb-12 transition-opacity duration-700"
          style={{ fontFamily: '"JetBrains Mono", monospace', opacity: done ? 1 : 0 }}
        >
          Capture marginalia · Dig up relics of your past · Ignite sparks
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

          <div className="flex flex-col items-center gap-8">
            {SPARKS.map((spark, i) => {
              const rotations = [-2, 1.5, -1];
              const offsets = ["self-start", "self-center", "self-end"];
              return (
                <div
                  key={i}
                  className={`w-full max-w-md ${offsets[i]} rounded-sm p-7`}
                  style={{
                    transform: `rotate(${rotations[i]}deg)`,
                    backgroundColor: "#f2e8c9",
                    backgroundImage: [
                      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.09'/%3E%3C/svg%3E\")",
                      "radial-gradient(ellipse at top left, rgba(160,110,40,0.18) 0%, transparent 55%)",
                      "radial-gradient(ellipse at bottom right, rgba(140,95,30,0.14) 0%, transparent 55%)",
                    ].join(", "),
                    border: "1px solid #c9a96e",
                    boxShadow: "inset 0 0 70px rgba(110,70,20,0.13), 0 6px 24px rgba(0,0,0,0.28), 0 1px 4px rgba(0,0,0,0.12)",
                  }}
                >
                  <span
                    className="inline-block text-[10px] uppercase tracking-widest border rounded-full px-2.5 py-0.5 mb-5"
                    style={{ fontFamily: '"JetBrains Mono", monospace', color: "#5a7a62", borderColor: "rgba(90,122,98,0.35)" }}
                  >
                    {spark.label}
                  </span>
                  <p
                    className="mb-5"
                    style={{
                      fontFamily: '"IM Fell English", Georgia, serif',
                      fontStyle: "italic",
                      fontSize: "1.05rem",
                      lineHeight: "1.85",
                      color: "#1a0e06",
                      textShadow: "0.4px 0.4px 0px rgba(26,14,6,0.45), 0 0 1.5px rgba(26,14,6,0.18)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    &ldquo;{spark.quote}&rdquo;
                  </p>
                  <p
                    style={{
                      fontFamily: '"IM Fell English", Georgia, serif',
                      fontSize: "0.8rem",
                      color: "#5a3e20",
                      textShadow: "0.3px 0.3px 0px rgba(90,62,32,0.4)",
                    }}
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

          {/* Email card — always white, represents a real email */}
          <div className="rounded-2xl bg-white shadow-2xl overflow-hidden mx-auto max-w-xs">
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
