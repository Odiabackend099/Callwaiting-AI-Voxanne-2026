import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        // Primary Button - Electric Blue (#0000FF) - Highest emphasis
        default: "bg-[#0000FF] text-white shadow-lg shadow-[#0000FF]/20 hover:shadow-xl hover:shadow-[#0000FF]/30 hover:scale-105 active:scale-100 focus-visible:ring-[#0000FF]/50",

        // Secondary Button - Medium Blue (#3366FF) - Medium emphasis
        secondary: "bg-[#3366FF] text-white shadow-md shadow-[#3366FF]/15 hover:shadow-lg hover:shadow-[#3366FF]/25 hover:scale-105 active:scale-100 focus-visible:ring-[#3366FF]/50",

        // Outline Button - Electric Blue Border - Low emphasis
        outline: "bg-white text-[#0000FF] border-2 border-[#0000FF] shadow-sm hover:shadow-md hover:bg-[#0000FF]/5 active:bg-[#0000FF]/10 focus-visible:ring-[#0000FF]/50",

        // Ghost Button - Minimal style
        ghost: "text-[#0000FF] hover:bg-[#AACCFF]/20 active:bg-[#AACCFF]/30 focus-visible:ring-[#0000FF]/30",

        // Destructive Button - Deep Navy (#0A0E27) - For delete/danger actions
        destructive: "bg-[#0A0E27] text-white shadow-md shadow-[#0A0E27]/20 hover:shadow-lg hover:shadow-[#0A0E27]/30 hover:scale-105 active:scale-100 focus-visible:ring-[#0A0E27]/50",

        // Link Button - Text only with underline
        link: "text-[#0000FF] font-medium underline-offset-4 hover:text-[#3366FF] hover:underline focus-visible:ring-[#0000FF]/30",
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
