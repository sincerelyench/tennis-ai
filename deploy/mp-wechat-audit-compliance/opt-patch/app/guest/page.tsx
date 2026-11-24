import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** ZQ-175: browse marketing removed — guests land on 排行榜. */
export default function GuestBrowsePage() {
  redirect("/ladder");
}
