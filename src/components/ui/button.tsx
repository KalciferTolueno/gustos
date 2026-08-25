import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 ease-[cubic-bezier(.16,1,.3,1)] outline-none hover:-translate-y-px active:translate-y-0 active:scale-[.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_10px_26px_-18px_rgba(255,255,255,.65)] hover:bg-primary/90",
      outline: "border border-white/15 bg-white/[.045] shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-xl hover:bg-accent hover:text-accent-foreground",
      secondary: "border border-white/10 bg-secondary shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-xl hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    },
    size: { default: "h-11 px-4 py-2", sm: "h-11 px-3 text-xs", lg: "h-12 px-6", icon: "size-11" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size, className }))} {...(!asChild && props.type === undefined ? { type: "button" } : {})} {...props} />;
}

export { Button, buttonVariants };
