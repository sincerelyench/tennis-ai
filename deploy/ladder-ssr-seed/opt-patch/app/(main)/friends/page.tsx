import { FriendsView } from "@/components/friends-view";
import { pageTitle } from "@/lib/i18n/page-meta";
import { loadFriendsSsrSeed } from "@/lib/friends-ssr-seed";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return pageTitle({ en: "Play", zh: "约球" });
}

/** ZQ-164d: SSR-seed 约球 success list + ladder so first HTML is not empty. */
export default async function FriendsPage() {
  const seed = await loadFriendsSsrSeed("singles");
  return (
    <FriendsView
      surface="match"
      initialCityId={seed.cityId}
      initialLadderRows={seed.ladderRows as never}
      initialSuccessRecords={seed.successRecords as never}
    />
  );
}
