import type { Metadata } from "next";
import { FriendsView } from "@/components/friends-view";

export const metadata: Metadata = { title: "Friends" };

export default function FriendsPage() {
  return <FriendsView />;
}
