import { FriendsView } from "@/components/friends-view";
import { pageTitle } from "@/lib/i18n/page-meta";
import { loadFriendsSsrSeed } from "@/lib/friends-ssr-seed";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return pageTitle({ en: "Ladder", zh: "排行榜" });
}

/** ZQ-164d: SSR-seed ladder so first HTML is not empty when client fetch never runs. */
export default async function LadderPage() {
  const seed = await loadFriendsSsrSeed("singles");
  return (
    <FriendsView
      surface="ladder"
      initialCityId={seed.cityId}
      initialLadderRows={seed.ladderRows as never}
      initialSuccessRecords={seed.successRecords as never}
    />
  );
}
