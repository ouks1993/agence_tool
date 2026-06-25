"use client";

import { useMemo, useState } from "react";
import {
  BedDouble,
  Building2,
  Globe,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Phone,
  Star,
} from "lucide-react";
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

/** Room-category prefix from a Hotelbeds room code, e.g. "DBL.ST" → "DBL". */
function roomPrefix(code?: string): string | null {
  if (!code) return null;
  return code.split(/[.-]/)[0] ?? null;
}

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

  // Order photos so the booked room's photos come first.
  const { gallery, roomPhotoCount } = useMemo(() => {
    const imgs = details?.images ?? [];
    const prefix = roomPrefix(offer.roomCode);
    const room = prefix
      ? imgs.filter((i) => roomPrefix(i.roomCode) === prefix)
      : [];
    const roomUrls = room.map((i) => i.url);
    const rest = imgs.map((i) => i.url).filter((u) => !roomUrls.includes(u));
    return { gallery: [...roomUrls, ...rest], roomPhotoCount: roomUrls.length };
  }, [details, offer.roomCode]);

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
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {offer.name}
            <span className="flex items-center text-amber-500">
              {Array.from({ length: offer.stars }).map((_, i) => (
                <Star key={i} className="size-3.5 fill-current" />
              ))}
            </span>
            {(details?.hotelType ?? offer.hotelType) && (
              <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                <Building2 className="size-3" />
                {details?.hotelType ?? offer.hotelType}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {gallery.length > 0 && (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gallery[activeImg]}
                  alt={offer.name}
                  className="aspect-video w-full rounded-lg object-cover"
                />
                {gallery.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {gallery.map((src, i) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setActiveImg(i)}
                        className={cn(
                          "relative size-16 shrink-0 overflow-hidden rounded-md border-2",
                          i === activeImg ? "border-primary" : "border-transparent"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                {roomPhotoCount > 0 && (
                  <p className="text-muted-foreground text-xs">
                    First {roomPhotoCount} photo{roomPhotoCount === 1 ? "" : "s"} show
                    the {offer.roomName ?? "selected room"}.
                  </p>
                )}
              </div>
            )}

            {/* Selected room + price */}
            <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg p-3">
              <div className="flex items-start gap-2 text-sm">
                <BedDouble className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">{offer.roomName ?? "Room"}</p>
                  <p className="text-muted-foreground text-xs">
                    {offer.boardType ?? "Room only"} ·{" "}
                    {offer.refundable ? "Refundable" : "Non-refundable"} · {offer.nights}{" "}
                    night{offer.nights === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">
                  {formatMoney(offer.priceTotal, offer.currency)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatMoney(offer.pricePerNight, offer.currency)}/night
                </p>
              </div>
            </div>

            {/* Tags */}
            {details && details.segments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {details.segments.map((s) => (
                  <span
                    key={s}
                    className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

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

            {/* Amenities */}
            {details && details.facilities.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Facilities</p>
                <div className="flex flex-wrap gap-1.5">
                  {details.facilities.map((f) => (
                    <span
                      key={f}
                      className="rounded-md border px-2 py-0.5 text-xs"
                    >
                      {f}
                    </span>
                  ))}
                </div>
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
