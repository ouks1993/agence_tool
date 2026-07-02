import { describe, it, expect } from "vitest";
import { statusTone, type StatusDomain } from "@/lib/status-tone";

describe("statusTone — known domain/status pairs", () => {
  const cases: [StatusDomain, string, string][] = [
    ["opportunity", "lead", "neutral"],
    ["opportunity", "qualified", "info"],
    ["opportunity", "won", "success"],
    ["opportunity", "lost", "danger"],
    ["client", "lead", "warning"], // client-lead differs from opportunity-lead
    ["client", "active", "success"],
    ["product", "sent", "info"],
    ["product", "rejected", "danger"],
    ["booking", "awaiting_payment", "warning"],
    ["booking", "completed", "success"],
    ["booking", "cancelled", "danger"],
    ["paymentRecord", "refunded", "neutral"],
    ["paymentSummary", "overdue", "danger"],
    ["commission", "void", "neutral"],
    ["subscription", "past_due", "warning"],
    ["subscription", "canceled", "danger"],
  ];

  it.each(cases)("statusTone(%s, %s) -> %s", (domain, status, tone) => {
    expect(statusTone(domain, status)).toBe(tone);
  });
});

describe("statusTone — fallbacks", () => {
  it("returns neutral for null / undefined / empty status", () => {
    expect(statusTone("booking", null)).toBe("neutral");
    expect(statusTone("booking", undefined)).toBe("neutral");
    expect(statusTone("booking", "")).toBe("neutral");
  });

  it("falls back through the generic table for a status not in the domain", () => {
    // "paid" isn't in the booking table but is in generic -> success.
    expect(statusTone("booking", "paid")).toBe("success");
  });

  it("returns neutral for a code in no table (never throws)", () => {
    expect(statusTone("booking", "totally_unknown")).toBe("neutral");
  });

  it("matches case-insensitively", () => {
    expect(statusTone("booking", "COMPLETED")).toBe("success");
    expect(statusTone("opportunity", "Won")).toBe("success");
  });
});
