import * as React from "react";

// Open dialogs, newest last: Escape closes only the top one (e.g. a confirm over the detail view).
const openStack: symbol[] = [];

export const Dialog = ({ open, onOpenChange, children }: any) => {
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const id = Symbol("dialog");
    openStack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openStack[openStack.length - 1] === id) onOpenChange?.(false);
    };
    document.addEventListener("keydown", onKey);
    // Move focus into the dialog so keyboard users start inside it.
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input, textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])'
    );
    (first ?? panelRef.current)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      openStack.splice(openStack.indexOf(id), 1);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 overflow-y-auto"
      onClick={() => onOpenChange?.(false)}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-full flex justify-center outline-none my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

// Plain string concatenation lets the generated stylesheet order decide which of two clashing
// utilities wins (e.g. max-w-lg vs max-w-6xl), so drop any default the caller overrides.
const DIALOG_BASE = ["bg-background", "text-foreground", "rounded-lg", "p-6", "w-full", "max-w-lg", "shadow-lg", "relative"];
const utilityGroup = (token: string) => token.replace(/^(?:[a-z0-9-]+:)+/, "").match(/^(max-w|bg|text|rounded|p|w|shadow)(?=-|$)/)?.[1];
export const DialogContent = ({ className = "", children }: any) => {
  const overridden = new Set(className.split(/\s+/).map(utilityGroup).filter(Boolean));
  const base = DIALOG_BASE.filter((token) => !overridden.has(utilityGroup(token))).join(" ");
  return <div className={`${base} ${className}`}>{children}</div>;
};
export const DialogHeader = ({ className, children }: any) => <div className={`flex flex-col space-y-1.5 text-center sm:text-left mb-4 ${className}`}>{children}</div>;
export const DialogTitle = ({ className, children }: any) => <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>{children}</h2>;
