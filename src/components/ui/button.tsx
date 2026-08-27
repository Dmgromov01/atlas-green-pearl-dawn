import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-base font-semibold transition-[transform,background-color,opacity,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-40 enabled:active:scale-[0.96] [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "btn-grad shadow-sm hover:opacity-90",
        solid: "bg-foreground text-background hover:opacity-90",
        secondary: "bg-muted text-foreground hover:bg-border",
        outline: "border border-border bg-card text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-destructive text-accent-foreground hover:opacity-90",
      },
      size: {
        default: "h-11 min-h-11 px-5",
        sm: "h-10 min-h-10 rounded-full px-4 text-sm",
        lg: "h-12 min-h-12 px-6",
        icon: "size-11",
        "icon-sm": "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
