"use client";

import dynamic from "next/dynamic";

const PostComments = dynamic(() => import("./PostComments"), {
  loading: () => (
    <section className="public-panel-soft rounded-[1.75rem] px-5 py-6 sm:px-8 sm:py-8">
      <div className="h-7 w-32 animate-pulse rounded-full bg-slate-200/80" />
      <div className="mt-5 space-y-3">
        <div className="h-28 animate-pulse rounded-[1.5rem] bg-slate-100/90" />
        <div className="h-24 animate-pulse rounded-[1.25rem] bg-slate-100/80" />
      </div>
    </section>
  ),
  ssr: false,
});

export default function DeferredPostComments({ slug }) {
  return <PostComments slug={slug} />;
}
