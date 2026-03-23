"use client";

import { useState } from "react";

import { submitContactMessage } from "../lib/api";

const INITIAL_FORM = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

export default function ContactForm({ className = "" }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      subject: form.subject.trim(),
      message: form.message.trim(),
    };

    if (!payload.name || !payload.email || !payload.subject || !payload.message) {
      setStatus("error");
      setMessage("Please fill all fields before sending.");
      return;
    }

    try {
      setStatus("loading");
      setMessage("");
      const response = await submitContactMessage(payload);
      setStatus("success");
      setMessage(response?.detail || "Your message has been sent.");
      setForm(INITIAL_FORM);
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || "Unable to send message right now.");
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className={`public-panel relative flex h-full flex-col overflow-hidden rounded-[2rem] p-5 sm:p-8 ${className}`.trim()}
    >
      <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_right,rgba(31,122,103,0.16),transparent_55%)]" />

      <div className="relative space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Send a Message
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">Tell us what you need</h2>
        <p className="text-sm leading-6 text-slate-600">
          Share your question, partnership request, or editorial feedback and we&apos;ll route it to the right team.
        </p>
      </div>

      <div className="relative mt-6 grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
            Full Name
          </span>
          <input
            name="name"
            value={form.name}
            onChange={onChange}
            suppressHydrationWarning
            maxLength={120}
            className="public-input h-12 w-full rounded-[1.1rem] px-4 transition"
            placeholder="Enter your name"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
            Email
          </span>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={onChange}
            suppressHydrationWarning
            className="public-input h-12 w-full rounded-[1.1rem] px-4 transition"
            placeholder="you@company.com"
          />
        </label>
      </div>

      <label className="relative mt-4 space-y-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
          Subject
        </span>
        <input
          name="subject"
          value={form.subject}
          onChange={onChange}
          suppressHydrationWarning
          maxLength={180}
          className="public-input h-12 w-full rounded-[1.1rem] px-4 transition"
          placeholder="How can we help?"
        />
      </label>

      <label className="relative mt-4 space-y-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
          Message
        </span>
        <textarea
          name="message"
          value={form.message}
          onChange={onChange}
          suppressHydrationWarning
          rows={6}
          className="public-textarea min-h-40 w-full rounded-[1.1rem] px-4 py-3 transition"
          placeholder="Write your message..."
        />
      </label>

      <div className="public-note relative mt-4 rounded-[1.5rem] p-4">
        <p
          aria-live="polite"
          className={`text-sm font-medium ${
            status === "error"
              ? "text-rose-600"
              : status === "success"
                ? "text-emerald-700"
                : "text-slate-600"
          }`}
        >
          {message || "We usually respond within 1-2 business days."}
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          A clear subject line and a little context help us resolve requests much faster.
        </p>
      </div>

      <div className="relative mt-auto flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
          All fields are required
        </p>
        <button
          type="submit"
          disabled={status === "loading"}
          className="public-button-primary inline-flex h-12 w-full items-center justify-center px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {status === "loading" ? "Sending..." : "Send Message"}
        </button>
      </div>
    </form>
  );
}
