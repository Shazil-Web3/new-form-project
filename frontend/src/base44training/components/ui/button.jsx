import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-b44-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-b44-primary text-b44-primary-foreground shadow hover:bg-b44-primary/90",
        destructive:
          "bg-b44-destructive text-b44-destructive-foreground shadow-sm hover:bg-b44-destructive/90",
        outline:
          "border border-b44-input bg-transparent shadow-sm hover:bg-b44-accent hover:text-b44-accent-foreground",
        secondary:
          "bg-b44-secondary text-b44-secondary-foreground shadow-sm hover:bg-b44-secondary/80",
        ghost: "hover:bg-b44-accent hover:text-b44-accent-foreground",
        link: "text-b44-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
