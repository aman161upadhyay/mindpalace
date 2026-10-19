import * as React from "react";
export const Dialog = ({ open, onOpenChange, children }: any) => { return open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => onOpenChange?.(false)}><div onClick={e => e.stopPropagation()}>{children}</div></div> : null; };
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
