import { matchStrokeId, strokeDemoFile, type ApiStroke } from "@/lib/analysis";

export type CoachMark = {
  id: string;
  label: string;
  x: number;
  y: number;
};

const GOOD: Record<string, CoachMark[]> = {
  serve: [
    { id: "toss", label: "Toss out in front", x: 48, y: 12 },
    { id: "contact", label: "Contact at the peak", x: 62, y: 20 },
    { id: "stance", label: "Feet wider than shoulders", x: 40, y: 88 },
  ],
  smash: [
    { id: "point", label: "Non-hitting hand points at the ball", x: 44, y: 18 },
    { id: "contact", label: "Contact above the head", x: 58, y: 16 },
    { id: "side", label: "Turn sideways to the ball", x: 38, y: 70 },
  ],
  "fh-topspin": [
    { id: "racket", label: "Racket head behind you", x: 22, y: 42 },
    { id: "contact", label: "Contact out in front", x: 68, y: 46 },
    { id: "stance", label: "Closed stance", x: 46, y: 86 },
  ],
  "fh-slice": [
    { id: "face", label: "Open racket face", x: 70, y: 40 },
    { id: "path", label: "High to low", x: 60, y: 28 },
    { id: "front", label: "Weight on the front foot", x: 52, y: 84 },
  ],
  "bh-topspin": [
    { id: "turn", label: "Full shoulder turn", x: 34, y: 30 },
    { id: "contact", label: "Contact out in front", x: 62, y: 44 },
    { id: "low", label: "Stay low", x: 48, y: 86 },
  ],
  "bh-slice": [
    { id: "face", label: "Open racket face", x: 68, y: 38 },
    { id: "shoulder", label: "Non-hitting hand turns the shoulders", x: 30, y: 32 },
    { id: "forward", label: "Send the racket head forward", x: 72, y: 50 },
  ],
  "fh-volley": [
    { id: "head", label: "Racket head up", x: 64, y: 28 },
    { id: "block", label: "Block, don't swing", x: 66, y: 44 },
    { id: "step", label: "Weight moves forward", x: 50, y: 84 },
  ],
  "bh-volley": [
    { id: "face", label: "Firm blocking face", x: 32, y: 40 },
    { id: "short", label: "Short follow-through", x: 28, y: 52 },
    { id: "square", label: "Shoulders square to the ball", x: 48, y: 30 },
  ],
};

const PROBLEM_DEFAULT: Record<string, CoachMark[]> = {
  serve: [
    { id: "racket", label: "Racket head not dropped", x: 60, y: 30 },
    { id: "contact", label: "Contact too low", x: 58, y: 36 },
    { id: "stance", label: "Stance too narrow", x: 46, y: 86 },
  ],
  smash: [
    { id: "late", label: "Contact late", x: 58, y: 28 },
    { id: "side", label: "No turn", x: 50, y: 70 },
  ],
  "fh-topspin": [
    { id: "contact", label: "Contact too far back", x: 38, y: 48 },
    { id: "racket", label: "Racket head dropped", x: 28, y: 58 },
    { id: "stance", label: "Stance too wide", x: 52, y: 86 },
  ],
  "fh-slice": [
    { id: "face", label: "Face closed too early", x: 66, y: 42 },
    { id: "high", label: "Slice too flat", x: 60, y: 36 },
  ],
  "bh-topspin": [
    { id: "turn", label: "Not enough shoulder turn", x: 40, y: 34 },
    { id: "late", label: "Contact late", x: 56, y: 50 },
  ],
  "bh-slice": [
    { id: "face", label: "Unsteady face", x: 64, y: 40 },
    { id: "late", label: "Slice late", x: 58, y: 48 },
  ],
  "fh-volley": [
    { id: "swing", label: "Swing too big", x: 68, y: 36 },
    { id: "late", label: "Feet not there", x: 50, y: 84 },
  ],
  "bh-volley": [
    { id: "open", label: "Face laid back", x: 30, y: 42 },
    { id: "late", label: "Late on the ball", x: 46, y: 70 },
  ],
};

const RULES: { test: RegExp; mark: CoachMark }[] = [
  { test: /拍没落|后摆偏浅|后口袋|引拍|racket head not dropped|late takeback/i, mark: { id: "racket", label: "Racket head not dropped", x: 62, y: 28 } },
  { test: /步幅偏窄|开立不够|两脚太近|站位|stance too narrow|feet too close/i, mark: { id: "stance", label: "Stance too narrow", x: 42, y: 86 } },
  { test: /击球点.*低|最高点|拍头偏慢|contact too low|peak/i, mark: { id: "contact", label: "Contact too low", x: 58, y: 32 } },
  { test: /击球点.*晚|太后|偏晚|contact late|too far back/i, mark: { id: "late", label: "Contact late", x: 40, y: 50 } },
  { test: /转肩|转髋|动力链|shoulder turn|kinetic chain/i, mark: { id: "turn", label: "Not enough shoulder turn", x: 36, y: 34 } },
  { test: /重心|直腿|weight|straight leg/i, mark: { id: "weight", label: "Weight too high", x: 48, y: 62 } },
  { test: /随挥|follow-?through/i, mark: { id: "follow", label: "Follow-through cut short", x: 72, y: 40 } },
];

function strokeKey(strokeId?: string | null, title?: string | null) {
  const id = (strokeId || "").trim();
  if (id && GOOD[id]) return id;
  return matchStrokeId(`${strokeId || ""} ${title || ""}`) || "fh-topspin";
}

export function goodMarks(strokeId?: string | null, title?: string | null) {
  return GOOD[strokeKey(strokeId, title)] || GOOD["fh-topspin"];
}

export function problemMarks(
  strokeId?: string | null,
  title?: string | null,
  findings: string[] = [],
) {
  const hits: CoachMark[] = [];
  const seen = new Set<string>();
  for (const line of findings) {
    for (const rule of RULES) {
      if (!rule.test.test(line) || seen.has(rule.mark.id)) continue;
      seen.add(rule.mark.id);
      hits.push(rule.mark);
    }
  }
  if (hits.length) return hits.slice(0, 4);
  return PROBLEM_DEFAULT[strokeKey(strokeId, title)] || PROBLEM_DEFAULT["fh-topspin"];
}

export function exampleStill(strokeId?: string | null, title?: string | null) {
  const key = strokeKey(strokeId, title) as ApiStroke;
  const file = strokeDemoFile[key] || strokeDemoFile["fh-topspin"];
  return `/tennis/examples/${file}.jpg`;
}

export function exampleClip(strokeId?: string | null, title?: string | null) {
  const key = strokeKey(strokeId, title) as ApiStroke;
  const file = strokeDemoFile[key] || strokeDemoFile["fh-topspin"];
  return `/tennis/examples/${file}.mp4`;
}
