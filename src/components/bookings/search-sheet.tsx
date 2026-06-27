"use client";

import { useState } from "react";
import type {
  BookingOption,
  ClientOption,
} from "@/components/search/add-to-booking-dialog";
import { SearchWorkspace } from "@/components/search/search-workspace";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Side-panel wrapper that embeds the full flight/hotel search workspace inside
 * a booking, pre-selecting the booking and seeding the hotel destination so
 * agents don't have to leave the booking and re-select it on the /search page.
 *
 * `bookings` and `clients` are server data fetched by the parent server
 * component and passed down (this component cannot fetch them itself).
 */
export function SearchSheet({
  bookingId,
  bookingRef,
  destination,
  bookings,
  clients,
  supplierLabel,
  trigger,
}: {
  bookingId: string;
  bookingRef: string;
  destination?: string | null | undefined;
  bookings: BookingOption[];
  clients: ClientOption[];
  supplierLabel: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-[85vw] sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>Search for {bookingRef}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <SearchWorkspace
            bookings={bookings}
            clients={clients}
            supplierLabel={supplierLabel}
            defaultBookingId={bookingId}
            defaultDestination={destination ?? undefined}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
