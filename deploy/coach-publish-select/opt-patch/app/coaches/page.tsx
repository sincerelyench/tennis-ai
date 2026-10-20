import { PlayerCoachPicker } from "@/components/player-coach-picker";

/** Player route: /tennis/coaches — pick a published coach style. */
export default function CoachesPage() {
  return (
    <main className="min-h-screen bg-background">
      <PlayerCoachPicker locale="zh" />
    </main>
  );
}
