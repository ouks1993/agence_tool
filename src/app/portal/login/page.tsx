"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Maps the ?error= flag set by the verify route to a human message.
const ERROR_MESSAGES: Record<string, string> = {
  expired: "That login link has expired. Request a new one below.",
  invalid: "That login link is invalid. Request a new one below.",
};

function PortalLoginForm() {
  const searchParams = useSearchParams();
  const errorFlag = searchParams.get("error");
  const linkError = errorFlag ? ERROR_MESSAGES[errorFlag] : null;

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Check your inbox</CardTitle>
            <CardDescription>
              If an account matching <strong>{email}</strong> exists, you&apos;ll
              receive a login link shortly. It expires in 15 minutes.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Access my trips</CardTitle>
          <CardDescription>
            Enter your email to receive a secure login link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkError && (
            <p className="mb-4 text-sm text-destructive">{linkError}</p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Send me a link"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={null}>
      <PortalLoginForm />
    </Suspense>
  );
}
