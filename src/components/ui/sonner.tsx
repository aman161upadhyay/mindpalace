import { Toaster as Sonner } from "sonner";
export const Toaster = ({ ...props }) => {
  return <Sonner className="toaster group" toastOptions={{ classNames: { toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg" } }} {...props} />;
};
