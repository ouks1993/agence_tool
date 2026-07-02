import { describe, it, expect } from "vitest";
import {
  BOOKING_LIFECYCLE,
  canAssignAdmin,
  canViewFinance,
  nextBookingStatus,
  roleHome,
  seesAllData,
  USER_ROLE_TONE,
  USER_ROLES,
  type UserRole,
} from "@/lib/domain";

describe("nextBookingStatus", () => {
  it("advances one step through the lifecycle", () => {
    expect(nextBookingStatus("draft")).toBe("awaiting_payment");
    expect(nextBookingStatus("awaiting_payment")).toBe("confirmed");
    expect(nextBookingStatus("confirmed")).toBe("ticketed");
    expect(nextBookingStatus("ticketed")).toBe("completed");
  });

  it("returns null at the terminal 'completed' status", () => {
    expect(nextBookingStatus("completed")).toBeNull();
  });

  it("returns null for 'cancelled' (not in the ordered lifecycle)", () => {
    expect(nextBookingStatus("cancelled")).toBeNull();
  });

  it("returns null for an unknown status", () => {
    expect(nextBookingStatus("nonsense")).toBeNull();
  });

  it("every non-terminal lifecycle step yields the following one", () => {
    for (let i = 0; i < BOOKING_LIFECYCLE.length - 1; i++) {
      expect(nextBookingStatus(BOOKING_LIFECYCLE[i]!)).toBe(
        BOOKING_LIFECYCLE[i + 1]
      );
    }
  });
});

describe("capability helpers", () => {
  it("seesAllData is true for everyone except agent", () => {
    const expected: Record<UserRole, boolean> = {
      admin: true,
      manager: true,
      finance: true,
      support: true,
      agent: false,
    };
    for (const role of USER_ROLES) {
      expect(seesAllData(role)).toBe(expected[role]);
    }
  });

  it("canAssignAdmin is admin-only", () => {
    for (const role of USER_ROLES) {
      expect(canAssignAdmin(role)).toBe(role === "admin");
    }
  });

  it("canViewFinance covers admin, manager and finance only", () => {
    const allowed = new Set<UserRole>(["admin", "manager", "finance"]);
    for (const role of USER_ROLES) {
      expect(canViewFinance(role)).toBe(allowed.has(role));
    }
  });
});

describe("roleHome", () => {
  it("routes finance and support to their workspaces", () => {
    expect(roleHome("finance")).toBe("/finance");
    expect(roleHome("support")).toBe("/support");
  });
  it("routes everyone else to the dashboard", () => {
    expect(roleHome("admin")).toBe("/dashboard");
    expect(roleHome("manager")).toBe("/dashboard");
    expect(roleHome("agent")).toBe("/dashboard");
  });
});

describe("USER_ROLE_TONE", () => {
  it("has a tone for every role in USER_ROLES", () => {
    for (const role of USER_ROLES) {
      expect(USER_ROLE_TONE[role]).toBeDefined();
    }
  });
});
