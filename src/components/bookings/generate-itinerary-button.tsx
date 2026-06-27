"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateItinerary } from "@/lib/actions/ai";

/**
 * AI-powered button that generates a day-by-day itinerary for a booking from
 * its flight/hotel items. Results are saved server-side; we refresh to show them.
 */
export function GenerateItineraryButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const generate = () => {
    startTransition(async () => {
      const res = await generateItinerary(bookingId);
      if (res.ok) {
        const dayCount = res.data?.dayCount ?? 0;
        toast.success(`Itinerary generated (${dayCount} days)`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={generate} disabled={pending}>
      <Sparkles className="mr-2 size-4" />
      {pending ? "Generating…" : "Generate with AI"}
    </Button>
  );
}
