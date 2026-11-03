import { redirect } from "next/navigation";

/** Devices settings removed — keep route as soft redirect to 我的. */
export default function DevicesPage() {
  redirect("/");
}
