import { ProfileView } from "@/components/profile-view";
import { pageTitle } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return pageTitle({ en: "Me", zh: "我的" });
}

export default function ProfilePage() {
  return <ProfileView />;
}
