import * as React from "react";
export const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  return <div ref={ref} className={`inline-flex items-center border rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`} {...props} />;
});
Badge.displayName = "Badge";
