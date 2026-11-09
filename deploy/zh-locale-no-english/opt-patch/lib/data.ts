import { ladderPlayers } from "@/lib/local-ladder";

export const pageClass = "mx-auto w-full max-w-md space-y-6 px-4 py-4";

export const profile = {
  name: "",  // filled from auth session displayName in ProfileView
  level: "",
  bio: "",
  analyses: 0,
  hours: "18h",
  friends: 0,
  rating: "B+",
  focus: "Forehand",
  focusShare: "42% of sessions",
  weekLabel: "4 / 7 days",
};

export const weekDays = [
  { id: "m", label: "M", trained: true, tone: "soft" as const },
  { id: "t", label: "T", trained: true, tone: "solid" as const },
  { id: "w", label: "W", trained: false, tone: "rest" as const },
  { id: "th", label: "Th", trained: true, tone: "solid" as const },
  { id: "f", label: "F", trained: true, tone: "solid" as const },
  { id: "sa", label: "Sa", trained: false, tone: "rest" as const },
  { id: "su", label: "Su", trained: false, tone: "rest" as const },
];

export const sessions = [
  { dayKey: "time.monday", titleKey: "plan.fhRallies", detailKey: "plan.doneMin", minutes: 45 },
  { dayKey: "time.tuesday", titleKey: "plan.fhFeeds", detailKey: "plan.doneMin", minutes: 30 },
  { dayKey: "time.wednesday", titleKey: "plan.rest", detailKey: "plan.nothing", minutes: 0 },
  { dayKey: "time.thursday", titleKey: "plan.serve", detailKey: "plan.doneMin", minutes: 40 },
  { dayKey: "time.friday", titleKey: "plan.baseline", detailKey: "plan.doneMin", minutes: 45 },
  { dayKey: "time.saturday", titleKey: "plan.rest", detailKey: "plan.nothing", minutes: 0 },
  { dayKey: "time.sunday", titleKey: "plan.rest", detailKey: "plan.nothing", minutes: 0 },
];

export type Clip = {
  id: string;
  title: string;
  when: string;
  rating: string;
  status: "done" | "failed" | "loading";
  summary: string;
};

export const initialClips: Clip[] = [
  {
    id: "fh",
    title: "Forehand baseline rallies",
    when: "Today 7:40 AM",
    rating: "B+",
    status: "done",
    summary: "Contact is a bit late. Finish the follow-through over the shoulder. Forehand is still the stroke you practice most.",
  },
  {
    id: "bh",
    title: "Backhand slice",
    when: "Yesterday 7:10 PM",
    rating: "B",
    status: "done",
    summary: "Racket face is steady. You can still send the ball a bit deeper.",
  },
  {
    id: "serve",
    title: "First serve",
    when: "Monday 6:20 PM",
    rating: "—",
    status: "failed",
    summary: "The camera missed the toss, so analysis failed.",
  },
];

export const reports = [
  {
    id: "fh",
    title: "Forehand baseline rallies",
    when: "Today 7:40 AM",
    rating: "B+",
    summary: "Contact is a bit late. Finish the follow-through over the shoulder.",
    failed: false,
  },
  {
    id: "bh",
    title: "Backhand slice",
    when: "Yesterday 7:10 PM",
    rating: "B",
    summary: "Racket face is steady. You can still send the ball a bit deeper.",
    failed: false,
  },
  {
    id: "serve",
    title: "First serve",
    when: "Monday 6:20 PM",
    rating: "—",
    summary: "The video missed the toss, so no report was generated.",
    failed: true,
  },
];

export type Friend = {
  id: string;
  name: string;
  ntrp: string;
  place: string;
  placeKey: string;
  strokes: string[];
};

export const friends: Friend[] = ladderPlayers.map((player) => ({
  id: player.id,
  name: player.name,
  ntrp: player.ntrp.toFixed(1),
  place: player.placeKey,
  placeKey: player.placeKey,
  strokes: player.strokes,
}));

export const notices = [
  {
    href: "/analysis",
    title: "Forehand analysis is ready",
    detail: "Grade B+ · Today 7:40 AM",
  },
  {
    href: "/plan",
    title: "This week's training",
    detail: "4 / 7 days",
  },
];

export const faqs = [
  {
    q: "How long should a video analysis clip be?",
    a: "15 seconds to 2 minutes is enough. Film from the side so the swing and contact point are clear.",
  },
  {
    q: "What does a B+ grade mean?",
    a: "At NTRP 3.0, B+ means this clip is generally solid, with a few things you can still fix.",
  },
  {
    q: "How do I connect a racket sensor?",
    a: "Turn the sensor on, open Devices, hold it near your phone, then search.",
  },
];

export function coachReply(text: string) {
  if (/正手|forehand/i.test(text)) {
    return "Move your forehand contact about half a racket head farther in front. Forehand is 42% of recent work. Finish over the shoulder first, then add racket-head speed.";
  }
  if (/计划|训练|这周|plan|week/i.test(text)) {
    return "The goal is 3 sessions a week, and you already trained 4 days. Leave Wednesday, Saturday, and Sunday as rest. Put forehand on the days you train.";
  }
  if (/发球|serve/i.test(text)) {
    return "The last first-serve clip did not finish analysis, most likely because the camera missed the toss. Next time film from the side so the toss and contact are both in frame.";
  }
  return "Start with forehand baseline rallies. At an NTRP 3.0 pace, rally for 20 minutes and watch recovery and contact.";
}
