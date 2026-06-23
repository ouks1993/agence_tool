import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lightweight native <select> styled to match the design system inputs.
 * Avoids pulling in an extra Radix dependency for simple dropdowns.
 */
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          data-slot="select"
          className={cn(
            "border-input flex h-9 w-full appearance-none rounded-md border bg-transparent px-3 py-1 pr-8 text-base shadow-xs transition-[color,box-shadow] outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:pointer-events-none disabled:opacity-50",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
            "md:text-sm dark:bg-input/30",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 opacity-50" />
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
