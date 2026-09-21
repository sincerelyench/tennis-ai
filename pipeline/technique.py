"""Coach-authored checkpoints, video-observable proxies, and rule hints.

Clock-face palm directions are coaching cues, not pixel measurements. Flags are
side-view proxies (path, turn, weight) for the LLM to confirm against keyframes.
"""

from __future__ import annotations

from collections import Counter

from pipeline.level import issue_text, parse_level, prompt_level_block

# 2D 投影会偏，只把明显越界当旁证。
ELBOW_RANGES = {
    "forehand": {"takeback": (130, 150), "contact": (140, 160), "follow": (100, 120)},
    "backhand": {"takeback": (120, 140), "contact": (130, 150), "follow": (100, 130)},
    "backhand_one": {"takeback": (140, 160), "contact": (150, 170), "follow": (120, 140)},
    "forehand_slice": {"takeback": (130, 150), "contact": (130, 150), "follow": (100, 130)},
    "backhand_slice": {"takeback": (120, 140), "contact": (120, 140), "follow": (100, 120)},
    "volley_fh": {"takeback": (120, 140), "contact": (130, 150), "follow": (100, 120)},
    "volley_bh": {"takeback": (120, 140), "contact": (140, 160), "follow": (100, 120)},
    "serve": {"takeback": (90, 110), "contact": (150, 170), "follow": (100, 120)},
    "smash": {"takeback": (90, 110), "contact": (150, 170), "follow": (100, 120)},
}

FLAG_SHORT = {
    "wipe_glass": "擦玻璃倾向",
    "arm_only": "只动手不转体",
    "no_weight_shift": "重心未前移",
    "hand_reach": "辅助手指球",
    "late_takeback": "引拍偏晚",
    "lean_back": "击球后仰",
    "follow_vertical": "随挥垂直上收",
    "follow_too_high": "反手收拍过高",
    "elbow_range": "肘角偏差大",
    "head_below_wrist": "拍头低于手腕",
}

_KIND_ALIAS = {
    "forehand": "forehand",
    "topspin": "forehand",
    "forehand_slice": "forehand_slice",
    "slice": "forehand_slice",
    "backhand": "backhand",
    "backhand_slice": "backhand_slice",
}


def normalize_kind(stroke: str) -> str:
    return _KIND_ALIAS.get(stroke, stroke or "forehand")


def elbow_in_range(kind: str, phase: str, deg: float | None, slack: float = 18.0) -> bool | None:
    if deg is None:
        return None
    spec = ELBOW_RANGES.get(normalize_kind(kind)) or ELBOW_RANGES["forehand"]
    lo, hi = spec.get(phase) or (0, 180)
    return (lo - slack) <= float(deg) <= (hi + slack)


def flags_from_values(
    kind: str,
    *,
    view: str = "side",
    slot_drop: float | None = None,
    takeback_height: float | None = None,
    body_turn: float | None = None,
    wrist_back: float | None = None,
    weight_shift: float | None = None,
    torso_lean: float | None = None,
    follow_forward: float | None = None,
    follow_up: float | None = None,
    takeback_dt: float | None = None,
    elbow_takeback: float | None = None,
    elbow_contact: float | None = None,
    elbow_follow: float | None = None,
    head_above_wrist: float | None = None,
    hand_reaches: bool = False,
) -> list[str]:
    """Conservative proxies. Missing numbers do not vote yes. Side-view groundstrokes only."""
    kind = normalize_kind(kind)
    flags: list[str] = []
    side = view in ("side", "oblique")
    ground = kind in ("forehand", "backhand")

    if side and kind == "forehand" and slot_drop is not None and takeback_height is not None:
        # 拍凳子：引拍有高度，再落到腰。擦玻璃：有高度却横扫不落。
        if takeback_height >= 0.12 and slot_drop < 0.05:
            flags.append("wipe_glass")

    if side and ground and wrist_back is not None and body_turn is not None:
        if wrist_back >= 0.16 and body_turn < 0.04:
            flags.append("arm_only")

    if side and ground and weight_shift is not None and weight_shift < 0.015:
        flags.append("no_weight_shift")

    if side and ground and hand_reaches:
        flags.append("hand_reach")

    if side and ground and takeback_dt is not None and takeback_dt < 0.10:
        flags.append("late_takeback")

    if side and ground and torso_lean is not None and torso_lean < -0.08:
        flags.append("lean_back")

    if side and ground and follow_up is not None and (follow_forward is None or follow_forward < 0.06) and follow_up > 0.22:
        flags.append("follow_vertical")

    if side and kind == "backhand" and follow_up is not None and follow_up > 0.35:
        flags.append("follow_too_high")

    if side and kind == "backhand" and head_above_wrist is not None:
        if head_above_wrist < -0.02:
            flags.append("head_below_wrist")

    if side and ground:
        off = 0
        for phase, deg in (
            ("takeback", elbow_takeback),
            ("contact", elbow_contact),
            ("follow", elbow_follow),
        ):
            ok = elbow_in_range(kind, phase, deg, slack=22.0)
            if ok is False:
                off += 1
        if off >= 2:
            flags.append("elbow_range")

    return flags


def flag_rates(flag_lists: list[list[str]]) -> dict[str, float]:
    n = max(len(flag_lists), 1)
    counts: Counter[str] = Counter()
    for row in flag_lists:
        counts.update(row or [])
    return {k: round(v / n, 2) for k, v in counts.items()}


def flag_notes(flags: list[str]) -> list[str]:
    return [FLAG_SHORT[f] for f in flags if f in FLAG_SHORT]


def _push_issue(problems: list[str], drills: list[str], issue: str, level, **kwargs) -> None:
    problem, drill = issue_text(issue, level, **kwargs)
    if problem:
        problems.append(problem)
    if drill:
        drills.append(drill)


def extra_findings(
    stroke: str,
    summary: dict,
    player_level: str = "3.0",
) -> tuple[list[str], list[str], list[str]]:
    """Stroke-specific lines for the rule layer (also passed to the LLM as hints)."""
    kind = normalize_kind(stroke)
    level = parse_level(player_level)
    rates = summary.get("flag_rates") or {}
    strengths: list[str] = []
    problems: list[str] = []
    drills: list[str] = []

    def rate(key: str) -> float:
        return float(rates.get(key) or 0.0)

    if kind == "forehand":
        if rate("wipe_glass") >= 0.3:
            _push_issue(problems, drills, "wipe_glass", level)
        elif (summary.get("slot_drop") or 0) >= 0.08:
            strengths.append("引拍后能看到由高往低落入击球槽，不是横着擦玻璃。")

    if rate("arm_only") >= 0.3:
        _push_issue(problems, drills, "arm_only", level)
    elif (summary.get("body_turn") or 0) >= 0.08:
        strengths.append("引拍能看到转体，不是只甩胳膊。")

    if rate("no_weight_shift") >= 0.35:
        _push_issue(problems, drills, "no_weight_shift", level)
    elif (summary.get("weight_shift") or 0) >= 0.05:
        strengths.append("击球时髋能向前送，不是钉在原地。")

    if rate("late_takeback") >= 0.35:
        _push_issue(problems, drills, "late_takeback", level)

    if rate("lean_back") >= 0.3:
        _push_issue(problems, drills, "lean_back", level)

    if rate("follow_vertical") >= 0.3:
        _push_issue(problems, drills, "follow_vertical", level)

    if kind == "backhand" and rate("follow_too_high") >= 0.3:
        _push_issue(problems, drills, "follow_too_high", level)

    if rate("head_below_wrist") >= 0.35:
        _push_issue(problems, drills, "head_below_wrist", level)

    elbow = summary.get("elbow_contact_deg")
    spec = ELBOW_RANGES.get(kind) or ELBOW_RANGES["forehand"]
    lo, hi = spec["contact"]
    if elbow is not None:
        if lo - 10 <= elbow <= hi + 10:
            strengths.append(f"击球肘角大约 {elbow:.0f}°，落在该技术常见范围（{lo}–{hi}°）。")
        elif rate("elbow_range") >= 0.4 or elbow < lo - 22 or elbow > hi + 22:
            problems.append(
                f"击球肘角大约 {elbow:.0f}°，和该技术常见范围 {lo}–{hi}° 差得比较多（2D 估算，只作参考）。"
            )

    return strengths, problems, drills


def _side_words(handed: str) -> dict[str, str]:
    if handed == "left":
        return {
            "front_sh": "右肩",
            "finish_sh": "右肩",
            "dom": "左手",
            "aux": "右手",
            "aux_clock": "9:00",
            "hit_side": "左侧",
            "bh_net_sh": "右肩",
        }
    return {
        "front_sh": "左肩",
        "finish_sh": "左肩",
        "dom": "右手",
        "aux": "左手",
        "aux_clock": "3:00",
        "hit_side": "右侧",
        "bh_net_sh": "左肩",
    }


def _card_forehand(w: dict[str, str]) -> str:
    return f"""【底线正手】
准备：重心降低，步幅略宽于肩，双手在身前，{w['front_sh']}对准来球（不是{w['aux']}去指球）。
引拍：身体整体转体拉拍，不要只动手。完成后拍头/掌心偏后下方。口令「拍凳子」：由高往低落到腰，再向前打。错误「擦玻璃」：掌心朝侧面横扫，球打向天花板。
钟表口令（看不清掌心就不要写钟点）：{w['dom']}大致指向 6:00，{w['aux']}大致指向 {w['aux_clock']}。
击球：拍子落到腰间再自下而上；击球点胸口高度、身体{w['hit_side']}稍外、身前约 45°。收拍到{w['finish_sh']}。
随挥：向前上方收，不要垂直上拎；手掌朝外不是朝身体。重上旋时收拍可以更低。
动力链：腿→腰髋→躯干→肩膀→手臂→球拍。
必查：①擦玻璃 ②只动手不转体 ③重心不前移 ④{w['aux']}指球而不是{w['front_sh']}对球。
肘角参考：引拍 130–150°，击球 140–160°，随挥 100–120°。"""


def _card_backhand(w: dict[str, str]) -> str:
    return f"""【底线反手】
准备：对手击球时立刻转肩（右手选手{w['bh_net_sh']}对网），非持拍手扶拍喉，双脚约肩宽，重心在前脚掌。
拉拍：非持拍手推拍向后，拍头高于手腕，用转肩带动；双手反拍左肘贴近身体；单反拍面稍关闭。
击球：身前约髋高，手腕固定、拍面垂直；重心后脚到前脚。双手反拍上侧手发力主导；单反手臂伸直。
随挥：向前推送到肩以上，但双手反拍收太高易失误；非持拍手接拍颈制动。
必查：①引拍过晚只能捞球 ②手腕松动掉拍头 ③击球后仰、击球点过高。
肘角参考：双手引拍 120–140° / 击球 130–150° / 随挥 100–130°；单反各段大约再大 20°。"""


def _scope() -> str:
    return """写给练球的人看。只点评底线正手和底线反手。
看不清的细节直接跳过，不要在报告里解释评价范围或拍摄规范，也不要点名切削、截击、发球、高压。"""


def _observability() -> str:
    return """【画面能看什么 / 看不准什么】
能看：屈膝和步幅、转肩还是只动手、击球点相对身体、挥拍先落还是横扫、随挥过肩还是上拎、重心起伏、是否跳起、肘角大致范围。
很难看准：掌心钟表方向、握拍（大陆式）、拍面精确开合、前臂内旋、甜区。看不清就写「拍头偏后下方 / 拍面朝侧面 / 轨迹横扫」，不要编 6:00。
slot_drop、body_turn、weight_shift、tech_flags 是 2D 旁证，必须和附图对照；旁证和画面打架时以画面为准。
背景杂乱时只认骨架和球拍框，不要把旁边的人当球员。"""


def prompt_knowledge(clip_ids: list[str], handed: str = "right", player_level: str = "3.0") -> str:
    w = _side_words(handed if handed in ("left", "right") else "right")
    wanted = {normalize_kind(i) for i in clip_ids if i}
    parts: list[str] = [prompt_level_block(player_level), _scope()]
    if "forehand" in wanted or not wanted:
        parts.append(_card_forehand(w))
    if "backhand" in wanted:
        parts.append(_card_backhand(w))
    parts.append(_observability())
    return "\n\n".join(parts)
