import { useLocation } from "wouter";
import { Highlighter, Mail } from "lucide-react";

const SUPPORT_EMAIL = "aupadhyay@mba2027.hbs.edu";

// Self-service reset is switched off until reset codes can be emailed: knowing someone's
// username and email must not be enough to take over their account.
export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const subject = encodeURIComponent("Mind Palace password reset");
  const body = encodeURIComponent("Hi, please reset the password for my Mind Palace account.\n\nUsername:\nEmail I signed up with:\n");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Highlighter className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          Email us from the address you signed up with and include your username. We'll verify it's you
          and send you a temporary password, usually within a day. Your highlights stay safe in the meantime.
        </p>

        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}
          className="mt-6 w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
        >
          <Mail className="w-4 h-4" />
          Email {SUPPORT_EMAIL}
        </a>

        <p className="text-xs text-muted-foreground mt-4">
          The Chrome extension keeps saving highlights while you wait — it doesn't need your password.
        </p>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Remember your password?{" "}
          <button onClick={() => navigate("/login")} className="text-primary hover:underline font-medium">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
