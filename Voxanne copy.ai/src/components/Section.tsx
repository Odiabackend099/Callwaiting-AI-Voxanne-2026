import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  fullWidth?: boolean;
}

export function Section({ children, className, id, fullWidth = false }: SectionProps) {
  return (
    <section id={id} className={cn("py-16 md:py-24 relative overflow-hidden", className)}>
      <div className={cn("px-4 md:px-6 mx-auto", fullWidth ? "w-full" : "max-w-7xl")}>
        {children}
      </div>
    </section>
  );
}
