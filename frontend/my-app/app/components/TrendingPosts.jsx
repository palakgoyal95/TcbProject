import Image from "next/image";

export default function TrendingPosts({ posts }) {

  return (

    <div className="grid md:grid-cols-3 gap-6 mb-12">

      {posts.map(post => (

        <div key={post.id} className="bg-white shadow rounded-lg">

          <div className="relative h-40 w-full">
            <Image
              src={
                typeof post?.image_url === "string"
                  ? post.image_url
                  : typeof post?.image === "string"
                    ? post.image
                    : "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80"
              }
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              className="object-cover"
            />
          </div>

          <div className="p-4">

            <h3 className="font-semibold">

              {post.title}

            </h3>

            <p className="text-sm text-gray-500 mt-2">

              {post.excerpt}

            </p>

          </div>

        </div>

      ))}

    </div>

  )

}
