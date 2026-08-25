import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn("flex min-h-11 w-full rounded-2xl border border-white/15 bg-white/[.045] px-4 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.07)] outline-none backdrop-blur-xl transition-[background-color,border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-white/30 focus-visible:bg-white/[.065] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", className)} {...props} />;
}

export { Input };
