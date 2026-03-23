import Image from "next/image";
import Link from "next/link";
import AuthorAvatar from "./AuthorAvatar";
import { getReadingTime } from "../lib/readingTime";

export default function PostCard({ post, categoryName }) {
  const readingMinutes = Number.parseInt(String(post?.reading_time_minutes || ""), 10);
  const readingTime =
    !Number.isNaN(readingMinutes) && readingMinutes > 0
      ? `${readingMinutes} min read`
      : getReadingTime(post?.content || post?.excerpt || "");
  const imageSrc =
    typeof post?.image_url === "string"
      ? post.image_url
      : typeof post?.image === "string"
        ? post.image
        : "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80";
  const fallbackCategoryLabel =
    typeof post?.category === "object"
      ? post?.category?.name || "Category"
      : `Category ${post?.category}`;

  return (
    <div className="public-panel-soft w-full min-w-0 overflow-hidden rounded-[1.6rem] transition duration-200 hover:-translate-y-1">
      <div className="relative h-40 w-full">
        <Image
          src={imageSrc}
          alt={post.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover"
        />
      </div>

      <div className="min-w-0 p-5">
        <span className="public-pill">
          {categoryName || fallbackCategoryLabel}
        </span>

        <Link
          href={`/blog/${post.slug}`}
          className="mt-4 block break-words text-lg font-semibold text-slate-900 transition hover:text-[#1f7a67]"
        >
          {post.title}
        </Link>

        <p className="mt-3 break-words text-sm leading-6 text-slate-600">
          {post.excerpt}
        </p>

        <div className="mt-4 flex items-center justify-between">
          <AuthorAvatar author={post.author} />
          <span className="text-xs text-slate-500">{readingTime}</span>
        </div>
      </div>
    </div>
  );
}
