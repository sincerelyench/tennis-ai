import { redirect } from "next/navigation";

/** 训练计划页已下线；旧链接回落到「我的」。 */
export default function PlanPage() {
  redirect("/");
}
