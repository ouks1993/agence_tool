import { cn } from "@/lib/utils"

type SkeletonVariant = "default" | "text" | "circle"

const skeletonVariants: Record<SkeletonVariant, string> = {
  // Standard block placeholder (cards, thumbnails, buttons).
  default: "rounded-md",
  // Inline text line — pill radius reads as a line of copy.
  text: "h-4 w-full rounded-full",
  // Avatar / icon placeholder.
  circle: "rounded-full",
}

function Skeleton({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: SkeletonVariant }) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "bg-muted animate-pulse",
        skeletonVariants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
export type { SkeletonVariant }
