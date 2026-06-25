"use client";

import { useState } from "react";
import { Globe, Image as ImageIcon, Loader2, MapPin, Phone, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getHotelDetailsAction } from "@/lib/actions/search";
import { formatMoney } from "@/lib/format";
import type { HotelDetails, HotelOffer } from "@/lib/suppliers";
import { cn } from "@/lib/utils";

/**
 * Shows rich hotel content — photo gallery, description, address, contact — in a
 * dialog. Content is fetched on first open (one provider call) to respect rate
 * limits, using the offer's own fields (name/stars/price) until it arrives.
 */
export function HotelDetailsDialog({ offer }: { offer: HotelOffer }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<HotelDetails | null>(null);
  const [activeImg, setActiveImg] = useState(0);

  const load = async () => {
    if (details || !offer.hotelCode) return;
    setLoading(true);
    const res = await getHotelDetailsAction(offer.hotelCode);
    setLoading(false);
    if (res.ok && res.data) setDetails(res.data);
    else toast.error(res.ok ? "No details available." : res.error);
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) load();
  };

  const images = details?.images ?? [];
  const mapUrl =
    details?.latitude && details?.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${details.latitude},${details.longitude}`
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ImageIcon className="mr-1 size-4" /> Photos &amp; details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {offer.name}
            <span className="flex items-center text-amber-500">
              {Array.from({ length: offer.stars }).map((_, i) => (
                <Star key={i} className="size-3.5 fill-current" />
              ))}
            </span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Gallery */}
            {images.length > 0 && (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[activeImg]}
                  alt={offer.name}
                  className="aspect-video w-full rounded-lg object-cover"
                />
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.map((src, i) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setActiveImg(i)}
                        className={cn(
                          "size-16 shrink-0 overflow-hidden rounded-md border-2",
                          i === activeImg ? "border-primary" : "border-transparent"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Price + contact */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <span className="text-lg font-bold">
                  {formatMoney(offer.priceTotal, offer.currency)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {formatMoney(offer.pricePerNight, offer.currency)}/night ·{" "}
                  {offer.nights} night{offer.nights === 1 ? "" : "s"}
                </span>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  offer.refundable
                    ? "bg-green-500/15 text-green-600 dark:text-green-400"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                )}
              >
                {offer.refundable ? "Refundable" : "Non-refundable"}
              </span>
            </div>

            {/* Address & contact */}
            {details && (
              <div className="text-muted-foreground space-y-1.5 text-sm">
                {(details.address || details.city) && (
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    <span>
                      {[details.address, details.city, details.postalCode, details.country]
                        .filter(Boolean)
                        .join(", ")}
                      {mapUrl && (
                        <>
                          {" — "}
                          <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            View on map
                          </a>
                        </>
                      )}
                    </span>
                  </p>
                )}
                {details.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="size-4 shrink-0" />
                    <a href={`tel:${details.phone}`} className="hover:underline">
                      {details.phone}
                    </a>
                  </p>
                )}
                {details.web && (
                  <p className="flex items-center gap-2">
                    <Globe className="size-4 shrink-0" />
                    <a
                      href={details.web.startsWith("http") ? details.web : `https://${details.web}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:underline"
                    >
                      {details.web}
                    </a>
                  </p>
                )}
              </div>
            )}

            {/* Description */}
            {details?.description && (
              <p className="text-sm leading-6 whitespace-pre-line">
                {details.description}
              </p>
            )}

            {!loading && !details && (
              <p className="text-muted-foreground text-sm">No details available.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
