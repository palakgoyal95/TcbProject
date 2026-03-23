import HomeLanding from "./components/HomeLanding";
import { getPopularPosts } from "./lib/api";

export const revalidate = 900;

export default async function Home() {
  const popularPosts = await getPopularPosts(6);

  return <HomeLanding popularPosts={Array.isArray(popularPosts) ? popularPosts : []} />;
}
