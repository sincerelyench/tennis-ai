import { LOCALES, messages, type Locale } from "./messages";

export type { Locale };
export { LOCALES, messages };

export const LOCALE_COOKIE = "tennis-locale";
export const LOCALE_STORAGE = "tennis-locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh";
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lang = (navigator.language || "").toLowerCase();
  return lang.startsWith("zh") ? "zh" : "en";
}

function lookup(tree: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = tree;
  for (let i = 0; i < parts.length; i += 1) {
    if (!current || typeof current !== "object") return undefined;
    const record = current as Record<string, unknown>;
    const rest = parts.slice(i).join(".");
    if (Object.prototype.hasOwnProperty.call(record, rest) && typeof record[rest] === "string") {
      return record[rest] as string;
    }
    if (!Object.prototype.hasOwnProperty.call(record, parts[i])) return undefined;
    current = record[parts[i]];
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(locale: Locale, key: string, vars?: Record<string, string | number>) {
  const raw = lookup(messages[locale], key) || lookup(messages.en, key) || key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => (vars[name] == null ? "" : String(vars[name])));
}

export function strokeName(locale: Locale, id?: string | null, fallback = "") {
  if (id && lookup(messages[locale], `stroke.${id}`)) return translate(locale, `stroke.${id}`);
  return fallback || id || "";
}

export function levelName(locale: Locale, id?: string | null, fallback = "") {
  const key = (id || "").trim();
  const table = (messages[locale] as { level?: Record<string, string> }).level;
  if (key && table?.[key]) return table[key];
  if (key && lookup(messages[locale], `level.${key}`)) return translate(locale, `level.${key}`);
  return fallback || key || "";
}

export function platformName(locale: Locale, id: string) {
  if (id === "in-app") return translate(locale, "platform.inApp");
  return lookup(messages[locale], `platform.${id}`) ? translate(locale, `platform.${id}`) : id;
}

const MARK_KEYS: Record<string, string> = {
  "toss out in front": "mark.tossFront",
  "contact at the peak": "mark.contactPeak",
  "feet wider than shoulders": "mark.feetWide",
  "non-hitting hand points at the ball": "mark.pointBall",
  "contact above the head": "mark.contactHead",
  "turn sideways to the ball": "mark.turnSide",
  "racket head behind you": "mark.racketBehind",
  "contact out in front": "mark.contactFront",
  "closed stance": "mark.closedStance",
  "open racket face": "mark.openFace",
  "high to low": "mark.highToLow",
  "weight on the front foot": "mark.weightFront",
  "full shoulder turn": "mark.fullTurn",
  "stay low": "mark.stayLow",
  "non-hitting hand turns the shoulders": "mark.handTurns",
  "send the racket head forward": "mark.sendForward",
  "racket head up": "mark.racketUp",
  "block, don't swing": "mark.block",
  "weight moves forward": "mark.weightForward",
  "firm blocking face": "mark.firmFace",
  "short follow-through": "mark.shortFollow",
  "shoulders square to the ball": "mark.square",
  "racket head not dropped": "mark.racketNotDropped",
  "contact too low": "mark.contactLow",
  "stance too narrow": "mark.stanceNarrow",
  "contact late": "mark.contactLate",
  "no turn": "mark.noTurn",
  "contact too far back": "mark.contactBack",
  "racket head dropped": "mark.racketDropped",
  "stance too wide": "mark.stanceWide",
  "face closed too early": "mark.faceClosed",
  "slice too flat": "mark.sliceFlat",
  "not enough shoulder turn": "mark.littleTurn",
  "unsteady face": "mark.unsteadyFace",
  "slice late": "mark.sliceLate",
  "swing too big": "mark.swingBig",
  "feet not there": "mark.feetLate",
  "face laid back": "mark.faceLaid",
  "late on the ball": "mark.lateBall",
  "weight too high": "mark.weightHigh",
  "follow-through cut short": "mark.followShort",
  抛球抛到身前: "mark.tossFront",
  在最高点击球: "mark.contactPeak",
  双脚宽于肩: "mark.feetWide",
  非持拍手指向球: "mark.pointBall",
  在头上方击球: "mark.contactHead",
  侧身对球: "mark.turnSide",
  拍头在身后: "mark.racketBehind",
  在身前击球: "mark.contactFront",
  关闭站位: "mark.closedStance",
  拍面打开: "mark.openFace",
  由高到低: "mark.highToLow",
  重心在前脚: "mark.weightFront",
  充分转肩: "mark.fullTurn",
  保持低位: "mark.stayLow",
  非持拍手带动转肩: "mark.handTurns",
  把拍头送出去: "mark.sendForward",
  拍头抬起: "mark.racketUp",
  "挡，不要挥": "mark.block",
  重心向前: "mark.weightForward",
  挡球拍面稳定: "mark.firmFace",
  随挥要短: "mark.shortFollow",
  双肩正对来球: "mark.square",
  拍头没有落下: "mark.racketNotDropped",
  击球点偏低: "mark.contactLow",
  站位偏窄: "mark.stanceNarrow",
  击球偏晚: "mark.contactLate",
  没有转身: "mark.noTurn",
  击球点太后: "mark.contactBack",
  拍头掉下去了: "mark.racketDropped",
  站位过宽: "mark.stanceWide",
  拍面关得太早: "mark.faceClosed",
  切削太平: "mark.sliceFlat",
  转肩不够: "mark.littleTurn",
  拍面不稳: "mark.unsteadyFace",
  切削偏晚: "mark.sliceLate",
  挥拍过大: "mark.swingBig",
  脚步没到位: "mark.feetLate",
  拍面后仰: "mark.faceLaid",
  对球偏晚: "mark.lateBall",
  重心偏高: "mark.weightHigh",
  随挥被截短: "mark.followShort",
};

export function markText(locale: Locale, label: string) {
  const key = MARK_KEYS[label.trim().toLowerCase()] || MARK_KEYS[label.trim()];
  return key ? translate(locale, key) : label;
}

const GRADE_KEYS: Record<string, string> = {
  优秀: "grade.excellent",
  良好: "grade.good",
  及格: "grade.pass",
  待提高: "grade.needsWork",
  需重构: "grade.rebuild",
  excellent: "grade.excellent",
  good: "grade.good",
  pass: "grade.pass",
  "needs work": "grade.needsWork",
  rebuild: "grade.rebuild",
};

export function displayGrade(locale: Locale, raw?: string | null) {
  const text = (raw || "").trim();
  if (!text) return "";
  const key = GRADE_KEYS[text] || GRADE_KEYS[text.toLowerCase()];
  return key ? translate(locale, key) : text;
}

const JOB_ERROR_KEYS: Record<string, string> = {
  "job.gone": "job.gone",
  "job.failside": "job.failSide",
  "job.timeout": "job.timeout",
  "job.notready": "job.notReady",
  "job.leavesubmit": "job.leaveHint",
  "job.leaverunning": "job.leaveHint",
  "job.leavehint": "job.leaveHint",
  "error.servicetimeout": "error.serviceTimeout",
  "error.uploadaborted": "error.uploadAborted",
  "error.cantreach": "error.cantReach",
  "error.busy": "error.busy",
  "error.authrejected": "error.authRejected",
  "error.uploadtimeout": "error.uploadTimeout",
  "error.toolarge": "error.tooLarge",
  "error.http400": "error.http400",
  "error.gateway": "error.gateway",
  "error.submittimeout": "error.submitTimeout",
  "error.trimtimeout": "error.trimTimeout",
  "error.serviceunreachable": "error.serviceUnreachable",
  "don't close this page until submit finishes.": "job.leaveHint",
  "submitted. you can leave this page. come back for progress or the report.": "job.leaveHint",
  "you can leave and do something else. come back to analyze and you will still be on this progress page.": "job.leaveHint",
  "this job is gone. please analyze again.": "job.gone",
  "this job was not found.": "job.gone",
  "analysis failed. try another side-view clip.": "job.failSide",
  "analysis is taking too long. your submit is on the server. check the list again later.": "job.timeout",
  "the report is not ready yet.": "job.notReady",
  "the report is not ready yet": "job.notReady",
  "can't reach the analysis service. please submit again.": "error.cantReach",
  "can't reach the analysis service right now.": "error.serviceUnreachable",
  "another video is still analyzing. wait for it to finish, then try again.": "error.busy",
  "analysis did not accept this sign-in. submit again without retrying an old session.": "error.authRejected",
  "upload timed out. submit a trimmed 10-second clip and try again.": "error.uploadTimeout",
  "the video is too large. submit a trimmed 10-second clip.": "error.tooLarge",
  "the analysis service did not accept this video (http 400). trim it again, or use a common mp4.": "error.http400",
  "the analysis service did not accept this video. trim it again, or use a common mp4.": "error.http400",
  "the analysis service did not respond. please try again in a moment.": "error.gateway",
  "submit timed out. try a shorter side-view clip.": "error.submitTimeout",
  "trim timed out. please try again.": "error.trimTimeout",
  "the analysis service timed out. try a shorter side-view clip.": "error.serviceTimeout",
  "submit failed. please try again.": "analysis.submitFail",
  "submit failed. please try again in a moment.": "analysis.submitFail",
};

const ZH_ONLY_ERROR_KEYS = new Set([
  "error.submitTimeout",
  "error.serviceTimeout",
  "error.uploadAborted",
  "error.uploadTimeout",
  "error.busy",
  "error.cantReach",
  "error.gateway",
  "error.serviceUnreachable",
  "error.trimTimeout",
  "error.tooLarge",
  "error.http400",
]);

export function localizeJobError(locale: Locale, text?: string | null, fallbackKey = "analysis.failRetry") {
  const raw = (text || "").trim();
  if (!raw) return translate("zh", fallbackKey);

  const mapped = JOB_ERROR_KEYS[raw.toLowerCase()];
  const asKey =
    mapped ||
    (lookup(messages.zh, raw) || lookup(messages.en, raw) ? raw : "");

  // Upload/submit failures always Chinese — locale=en was showing
  // "Submit timed out..." on top of Chinese「服务器接收中」.
  if (asKey && ZH_ONLY_ERROR_KEYS.has(asKey)) {
    return translate("zh", asKey);
  }
  if (/submit timed out|analysis service timed out|upload interrupted|upload timed out/i.test(raw)) {
    return translate("zh", mapped || "error.submitTimeout");
  }

  if (asKey && (lookup(messages[locale], asKey) || lookup(messages.en, asKey))) {
    return translate(locale, asKey);
  }
  const localized = localizeFinding(locale, raw);
  if (locale === "en" && /[\u4e00-\u9fff]/.test(localized)) return translate("zh", fallbackKey);
  if (locale === "zh" && !/[\u4e00-\u9fff]/.test(localized) && /[A-Za-z]{4,}/.test(localized)) {
    return translate("zh", fallbackKey);
  }
  return localized;
}

const FINDING_EXACT: Record<string, string> = {
  "有效挥拍样本过少，以下判断置信度偏低": "finding.fewSamples",
  "有效挥拍样本过少，以下判断置信度偏低。": "finding.fewSamples",
  "too few valid swing samples, so the reads below have lower confidence": "finding.fewSamples",
  "too few valid swing samples, so the reads below have lower confidence.": "finding.fewSamples",
  "击球点偏低，球在胸口以下才碰到，人容易被带着弯腰捞球": "finding.contactLowScoop",
  "击球点偏低，球在胸口以下才碰到，人容易被带着弯腰捞球。": "finding.contactLowScoop",
  "contact is too low — the ball is met below chest height, which pulls you into a bent-over scoop":
    "finding.contactLowScoop",
  "contact is too low — the ball is met below chest height, which pulls you into a bent-over scoop.":
    "finding.contactLowScoop",
  "准备时左手伸去够球了。对准来球的应该是左肩，不是左手": "finding.leftHandReach",
  "准备时左手伸去够球了。对准来球的应该是左肩，不是左手。": "finding.leftHandReach",
  "in the ready position the left hand reached for the ball. the left shoulder should line up with the incoming ball, not the left hand":
    "finding.leftHandReach",
  "in the ready position the left hand reached for the ball. the left shoulder should line up with the incoming ball, not the left hand.":
    "finding.leftHandReach",
  "本报告根据训练录像自动生成，仅供练习参考，不能替代现场教练": "finding.autoReport",
  "本报告根据训练录像自动生成，仅供练习参考，不能替代现场教练。": "finding.autoReport",
  "this report is generated from a training clip for practice only and does not replace an on-court coach":
    "finding.autoReport",
  "this report is generated from a training clip for practice only and does not replace an on-court coach.":
    "finding.autoReport",
  "评分来自画面，距离和角度会有一定误差": "finding.scoreFromFrame",
  "评分来自画面，距离和角度会有一定误差。": "finding.scoreFromFrame",
  "scores come from the picture, so distance and angle add some error": "finding.scoreFromFrame",
  "scores come from the picture, so distance and angle add some error.": "finding.scoreFromFrame",
  分析完成: "report.complete",
  "分析完成。": "report.complete",
  "analysis complete": "report.complete",
  "analysis complete.": "report.complete",
};

const STROKE_LABEL_IDS: Record<string, string> = {
  发球: "serve",
  一发: "serve",
  serve: "serve",
  高压: "smash",
  高压球: "smash",
  smash: "smash",
  overhead: "smash",
  反手切削: "bh-slice",
  "bh-slice": "bh-slice",
  反手截击: "bh-volley",
  "bh-volley": "bh-volley",
  反手上旋: "bh-topspin",
  反手: "bh-topspin",
  backhand: "bh-topspin",
  正手切削: "fh-slice",
  "fh-slice": "fh-slice",
  正手截击: "fh-volley",
  "fh-volley": "fh-volley",
  正手上旋: "fh-topspin",
  正手: "forehand",
  "fh-topspin": "fh-topspin",
  forehand: "forehand",
};

function localizeStrokeToken(locale: Locale, token: string) {
  const id = STROKE_LABEL_IDS[token] || STROKE_LABEL_IDS[token.toLowerCase()] || "";
  if (id && lookup(messages[locale], `stroke.${id}`)) return translate(locale, `stroke.${id}`);
  return token;
}

const FINDING_PHRASES: Array<[string, string]> = [
  ["这次按【发球】来看", "Scored as a serve"],
  ["这次按【正手上旋】来看", "Scored as a forehand topspin"],
  ["这次按【正手切削】来看", "Scored as a forehand slice"],
  ["这次按【反手上旋】来看", "Scored as a backhand topspin"],
  ["这次按【反手切削】来看", "Scored as a backhand slice"],
  ["这次按【正手截击】来看", "Scored as a forehand volley"],
  ["这次按【反手截击】来看", "Scored as a backhand volley"],
  ["这次按【高压球】来看", "Scored as a smash"],
  ["这次按【高压】来看", "Scored as a smash"],
  ["这次按【正手】来看", "Scored as a forehand"],
  ["这次按【反手】来看", "Scored as a backhand"],
  ["拍摄角度会影响判断：背面录像较难看清击球点前后位置和拍面开合", "Camera angle affects the read: a rear view makes contact depth and face angle harder to judge"],
  ["本报告根据训练录像自动生成，仅供练习参考，不能替代现场教练", "This report is generated from a training clip for practice only and does not replace an on-court coach"],
  ["评分来自画面，距离和角度会有一定误差", "Scores come from the picture, so distance and angle add some error"],
  ["有效挥拍样本过少，以下判断置信度偏低", "Too few valid swing samples, so the reads below have lower confidence"],
  ["击球点偏低，球在胸口以下才碰到，人容易被带着弯腰捞球", "Contact is too low — the ball is met below chest height, which pulls you into a bent-over scoop"],
  ["准备时左手伸去够球了。对准来球的应该是左肩，不是左手", "In the ready position the left hand reached for the ball. The left shoulder should line up with the incoming ball, not the left hand"],
  ["抛球不稳、打点偏低", "Unsteady toss and contact too low"],
  ["抛球不稳", "Unsteady toss"],
  ["打点偏低", "Contact too low"],
  ["打点低、贴身捞", "Contact too low and scooped in close"],
  ["点贴在头侧", "Contact tucked beside the head"],
  ["点贴在身体右侧", "Contact tucked on the right side"],
  ["只能在身边捞", "You can only scoop beside the body"],
  ["没有打在最高点", "The ball is not met at the peak"],
  ["引拍只动手", "The takeback is arm-only"],
  ["拍子还在腰边", "The racket stays at the hip"],
  ["拍在腰边", "The racket stays at the hip"],
  ["没有侧身", "No turn sideways"],
  ["没侧身", "No turn sideways"],
  ["没把拍落到身后掏出来", "The racket is not dropped behind you like a pocket takeout"],
  ["没掏口袋", "No pocket takeout"],
  ["侧身、掏口袋", "Turn sideways, pocket takeout"],
  ["抛稳、顶上再打", "Steady toss, hit at the top"],
  ["蹲一点、落到左边", "Sit a little, finish to the left"],
  ["腿直、随挥上拎", "Straight legs and a lift-up finish"],
  ["腿直、随挥停在头上", "Straight legs, finish parked above the head"],
  ["随挥停在头上往上拎", "The finish stops above the head and lifts up"],
  ["没有斜向左侧下落", "It does not drop diagonally to the left"],
  ["人站得高", "The body stays too tall"],
  ["准备时腿是直的", "The legs are straight in the ready position"],
  ["人站着甩胳膊", "Standing up and swinging the arm"],
  ["只甩胳膊", "Arm-only swing"],
  ["球发不深", "The serve does not land deep"],
  ["人不上腿更飘", "Without using the legs the body floats"],
  ["背面看不清前后", "A rear view cannot show front-to-back contact"],
  ["偏右侧/贴身", "Too far right / too close"],
  ["左侧偏贴身", "Too close on the left"],
  ["2D 估算，只作参考", "2D estimate, for reference only"],
  ["口令", "Cue"],
  ["过关", "Pass mark"],
  ["自抛", "Self toss"],
  ["空挥", "Shadow swing"],
  ["挡网", "Against the fence"],
  ["【问题】", "Problem: "],
  ["【原因】", "Cause: "],
  ["【训练】", "Drill: "],
  ["击球点偏低", "Contact too low"],
  ["击球点太后", "Contact too far back"],
  ["击球偏晚", "Contact late"],
  ["转肩不够", "Not enough shoulder turn"],
  ["拍头掉下去了", "Racket head dropped"],
  ["拍面关得太早", "Face closed too early"],
  ["切削太平", "Slice too flat"],
  ["拍面不稳", "Unsteady face"],
  ["切削偏晚", "Slice late"],
  ["挥拍过大", "Swing too big"],
  ["脚步没到位", "Feet not there"],
  ["拍面后仰", "Face laid back"],
  ["对球偏晚", "Late on the ball"],
  ["重心偏高", "Weight too high"],
  ["随挥被截短", "Follow-through cut short"],
  ["站位偏窄", "Stance too narrow"],
  ["站位过宽", "Stance too wide"],
  ["没有转身", "No turn"],
];

const PHRASE_ZH_TO_EN = [...FINDING_PHRASES].sort((a, b) => b[0].length - a[0].length);
const PHRASE_EN_TO_ZH = [...FINDING_PHRASES].sort((a, b) => b[1].length - a[1].length);

function applyPhrases(locale: Locale, text: string) {
  let next = text;
  if (locale === "en") {
    for (const [zh, en] of PHRASE_ZH_TO_EN) next = next.split(zh).join(en);
  } else {
    for (const [zh, en] of PHRASE_EN_TO_ZH) {
      if (en.length >= 4) next = next.split(en).join(zh);
    }
  }
  return next;
}

function applyFindingTemplates(locale: Locale, text: string) {
  const elbow = text.match(
    /击球肘角大约\s*([\d.]+)\s*°[，,]\s*和该技术常见范围\s*([\d.]+)\s*[–\-〜~]\s*([\d.]+)\s*°\s*差得比较多（2D 估算，只作参考）[。.]?/,
  );
  if (elbow) {
    return translate(locale, "finding.elbowAngle", { deg: elbow[1], lo: elbow[2], hi: elbow[3] });
  }
  const elbowEn = text.match(
    /contact elbow is about\s*([\d.]+)°,\s*quite far from the usual\s*([\d.]+)[–\-]\s*([\d.]+)° range for this stroke/i,
  );
  if (elbowEn) {
    return translate(locale, "finding.elbowAngle", { deg: elbowEn[1], lo: elbowEn[2], hi: elbowEn[3] });
  }
  return "";
}

function localizeScoredPrefix(locale: Locale, text: string) {
  return text.replace(/这次按【([^】]+)】来看[。.]?/g, (_, token: string) => {
    return `${translate(locale, "finding.scoredAs", { stroke: localizeStrokeToken(locale, token) })} `;
  }).replace(/scored as (?:a )?([^.]+)\./gi, (_, token: string) => {
    return `${translate(locale, "finding.scoredAs", { stroke: localizeStrokeToken(locale, token.trim()) })} `;
  });
}

export function localizeFinding(locale: Locale, text: string) {
  const raw = (text || "").trim();
  if (!raw) return "";
  const grade = displayGrade(locale, raw);
  if (grade && grade !== raw && !/[。.;]/.test(raw)) return grade;

  const trimmed = raw.replace(/[。．.]+$/, "");
  const exact = FINDING_EXACT[raw] || FINDING_EXACT[trimmed] || FINDING_EXACT[trimmed.toLowerCase()];
  if (exact) return translate(locale, exact);

  const marked = markText(locale, trimmed);
  if (marked !== trimmed) return marked;

  const templated = applyFindingTemplates(locale, raw);
  if (templated) return templated;

  let next = localizeScoredPrefix(locale, raw);
  next = applyPhrases(locale, next);
  next = next
    .replace(/【问题】/g, `${translate(locale, "finding.problem")}: `)
    .replace(/【原因】/g, `${translate(locale, "finding.cause")}: `)
    .replace(/【训练】/g, `${translate(locale, "finding.drill")}: `);

  if (locale === "en" && /[\u4e00-\u9fff]/.test(next)) return translate(locale, "finding.generic");
  return next.replace(/\s+/g, " ").trim();
}
