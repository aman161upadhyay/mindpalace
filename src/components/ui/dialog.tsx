import * as React from "react";
export const Dialog = ({ open, onOpenChange, children }: any) => { return open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => onOpenChange?.(false)}><div onClick={e => e.stopPropagation()}>{children}</div></div> : null; };
export const DialogContent = ({ className, children }: any) => <div className={`bg-background text-foreground rounded-lg p-6 w-full max-w-lg shadow-lg relative ${className}`}>{children}</div>;
export const DialogHeader = ({ className, children }: any) => <div className={`flex flex-col space-y-1.5 text-center sm:text-left mb-4 ${className}`}>{children}</div>;
export const DialogTitle = ({ className, children }: any) => <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>{children}</h2>;
