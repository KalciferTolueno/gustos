import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-6 rounded-[1.75rem] border border-white/15 bg-card text-card-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_22px_60px_-38px_rgba(0,0,0,.9)]", className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-1.5 px-6 sm:has-data-[slot=card-action]:grid-cols-[1fr_auto]", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("font-semibold leading-none", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />;
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-action" className={cn("col-start-1 row-start-3 mt-3 self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-6", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center px-6", className)} {...props} />;
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
