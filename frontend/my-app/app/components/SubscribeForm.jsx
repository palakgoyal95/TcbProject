"use client";

import { useState } from "react";

import { submitSubscription } from "../lib/api";

export default function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setStatus("error");
      setMessage("Please enter your email.");
      return;
    }

    try {
      setStatus("loading");
      setMessage("");
      const payload = await submitSubscription(trimmedEmail);
      setStatus("success");
      setMessage(payload?.detail || "Subscription confirmed.");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || "Unable to subscribe right now.");
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          suppressHydrationWarning
          placeholder="Enter your email"
          aria-label="Email address for updates"
          className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-300/80 focus:border-white/45 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          suppressHydrationWarning
          className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-[#f6efe2] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? "..." : "Subscribe"}
        </button>
      </div>
      {message ? (
        <p
          className={`mt-2 text-xs ${
            status === "error" ? "text-rose-200" : "text-cyan-100"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
