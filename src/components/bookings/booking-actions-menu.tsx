"use client";

import Link from "next/link";
import {
  FileText,
  Map as MapIcon,
  MoreHorizontal,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Overflow menu collecting the secondary booking-document actions (deck: the
 * hero keeps one primary + a couple of outline actions, the rest tuck away).
 * Pure-navigation links only — all real routes are preserved; nothing here
 * mutates state.
 */
export function BookingActionsMenu({
  bookingId,
  extra,
}: {
  bookingId: string;
  /** Additional menu rows (e.g. portal invite / delete) rendered below docs. */
  extra?: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="More actions">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Documents</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/bookings/${bookingId}/itinerary`}>
            <MapIcon className="size-4" />
            Itinerary
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/booking-docs/${bookingId}/voucher`} target="_blank">
            <FileText className="size-4" />
            Voucher
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/booking-docs/${bookingId}/invoice`} target="_blank">
            <Receipt className="size-4" />
            Invoice
          </Link>
        </DropdownMenuItem>
        {extra && (
          <>
            <DropdownMenuSeparator />
            {extra}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
