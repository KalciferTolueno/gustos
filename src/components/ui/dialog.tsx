"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return <DialogPrimitive.Overlay className={cn("dialog-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm", className)} {...props} />;
}

function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return <DialogPrimitive.Portal><DialogOverlay /><DialogPrimitive.Content className={cn("dialog-content fixed left-1/2 top-1/2 z-50 grid max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto overscroll-contain rounded-[1.875rem] border border-white/15 bg-popover/80 p-6 text-popover-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_34px_100px_rgba(0,0,0,.65)] backdrop-blur-2xl", className)} {...props}>{children}<DialogPrimitive.Close aria-label="Cerrar diálogo" className="absolute right-3 top-3 grid size-11 place-items-center rounded-2xl border border-white/10 bg-background/60 text-foreground shadow-lg backdrop-blur-xl transition-colors hover:bg-background/85"><X aria-hidden="true" className="size-4" /><span className="sr-only">Cerrar</span></DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal>;
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2 pr-8 text-left", className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-xl font-medium", className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />;
}

export { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger };
