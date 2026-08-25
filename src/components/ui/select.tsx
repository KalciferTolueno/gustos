"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return <SelectPrimitive.Trigger className={cn("flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl border border-white/15 bg-white/[.045] px-4 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.07)] outline-none backdrop-blur-xl focus:ring-2 focus:ring-ring disabled:opacity-50", className)} {...props}>{children}<SelectPrimitive.Icon asChild><ChevronDown aria-hidden="true" className="size-4 opacity-50" /></SelectPrimitive.Icon></SelectPrimitive.Trigger>;
}

function SelectContent({ className, children, position = "popper", ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return <SelectPrimitive.Portal><SelectPrimitive.Content position={position} className={cn("relative z-[70] max-h-96 min-w-[8rem] overflow-hidden rounded-2xl border border-white/15 bg-popover/85 text-popover-foreground shadow-2xl backdrop-blur-2xl", position === "popper" && "translate-y-1", className)} {...props}><SelectPrimitive.ScrollUpButton className="flex h-9 items-center justify-center"><ChevronUp aria-hidden="true" className="size-4" /></SelectPrimitive.ScrollUpButton><SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport><SelectPrimitive.ScrollDownButton className="flex h-9 items-center justify-center"><ChevronDown aria-hidden="true" className="size-4" /></SelectPrimitive.ScrollDownButton></SelectPrimitive.Content></SelectPrimitive.Portal>;
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return <SelectPrimitive.Item className={cn("relative flex min-h-11 w-full cursor-default select-none items-center rounded-lg py-2 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground", className)} {...props}><span className="absolute left-2 flex size-4 items-center justify-center"><SelectPrimitive.ItemIndicator><Check aria-hidden="true" className="size-4" /></SelectPrimitive.ItemIndicator></span><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText></SelectPrimitive.Item>;
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
