import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        // Primary Button - Surgical Blue - Highest emphasis
        default: "bg-surgical-600 text-white shadow-lg shadow-surgical-600/20 hover:shadow-xl hover:shadow-surgical-600/30 hover:scale-105 active:scale-100 focus-visible:ring-surgical-600/50",

        // Secondary Button - Medium emphasis
        secondary: "bg-surgical-500 text-white shadow-md shadow-surgical-500/15 hover:shadow-lg hover:shadow-surgical-500/25 hover:scale-105 active:scale-100 focus-visible:ring-surgical-500/50",

        // Outline Button - Low emphasis
        outline: "bg-white text-surgical-600 border-2 border-surgical-200 shadow-sm hover:shadow-md hover:bg-surgical-50 hover:border-surgical-300 active:bg-surgical-100 focus-visible:ring-surgical-600/50",

        // Ghost Button - Minimal style
        ghost: "text-surgical-600 hover:bg-surgical-100/50 active:bg-surgical-100 focus-visible:ring-surgical-600/30",

        // Destructive Button - Deep Obsidian - For delete/danger actions
        destructive: "bg-obsidian text-white shadow-md shadow-obsidian/20 hover:shadow-lg hover:shadow-obsidian/30 hover:scale-105 active:scale-100 focus-visible:ring-obsidian/50",

        // Link Button - Text only with underline
        link: "text-surgical-600 font-medium underline-offset-4 hover:text-surgical-700 hover:underline focus-visible:ring-surgical-600/30",
      },
      size: {
        default: "h-10 px-4 py-2.5",
        sm: "h-9 px-3 py-2 text-xs",
        lg: "h-11 px-6 py-3 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
