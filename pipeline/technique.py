"""Coach-authored checkpoints, video-observable proxies, and rule hints.

Clock-face palm directions are coaching cues, not pixel measurements. Flags are
side-view proxies (path, turn, weight) for the LLM to confirm against keyframes.
"""

from __future__ import annotations

import re
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
    "fh-topspin": "forehand",
    "正手上旋": "forehand",
    "底线正手": "forehand",
    "forehand_slice": "forehand_slice",
    "fh-slice": "forehand_slice",
    "slice": "forehand_slice",
    "正手切削": "forehand_slice",
    "backhand": "backhand",
    "bh-topspin": "backhand",
    "反手上旋": "backhand",
    "底线反手": "backhand",
    "backhand_slice": "backhand_slice",
    "bh-slice": "backhand_slice",
    "反手切削": "backhand_slice",
    "volley_fh": "volley_fh",
    "fh-volley": "volley_fh",
    "截击正手": "volley_fh",
    "正手截击": "volley_fh",
    "volley_bh": "volley_bh",
    "bh-volley": "volley_bh",
    "截击反手": "volley_bh",
    "反手截击": "volley_bh",
    "serve": "serve",
    "发球": "serve",
    "smash": "smash",
    "高压": "smash",
    "高压球": "smash",
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
    # 对齐八项技术要领 · 底线正手（正手上旋映射到本章）
    return f"""【底线正手】（用户说「正手上旋」即用本章）
准备：重心降低；步幅略宽于肩；双手举在身体正前方；{w['front_sh']}对准来球（不是{w['aux']}去指球）。
引拍：身体作为整体转体拉拍，从前往后没有任何多余动作；保持准备姿势不变，仅通过转动身体完成拉拍；完成后主导手掌心朝向 6:00（后下方）。右手选手：{w['dom']}指向 6:00，{w['aux']}指向 {w['aux_clock']}。口令「拍凳子」：由高往低落到腰再向前打。错误「擦玻璃」：掌心朝侧面横扫，球打向天花板。
击球：拍子由高往下放至腰间；自下而上击球（标准上旋）；击球瞬间手臂内旋；收拍到{w['finish_sh']}；击球点胸口高度、身体{w['hit_side']}稍远、身前约 45°。
随挥：手臂内旋往前上方收拍；不能垂直向上收拍；手掌心朝外不是朝身体；重上旋时收拍位置更低。
动力链：腿 → 腰髋 → 躯干 → 肩膀 → 手臂 → 球拍。
常见错误：①擦玻璃 ②只动手不转体 ③重心未向前转移 ④{w['aux']}指球而非{w['front_sh']}对球。
肘角参考：引拍 130–150°，击球 140–160°，随挥 100–120°。"""


def _card_backhand(w: dict[str, str]) -> str:
    return f"""【底线反手】
准备：对手击球时立即转肩（右手选手{w['bh_net_sh']}对球网）；非持拍手扶拍喉辅助引拍；双脚与肩同宽，膝盖微屈，重心在前脚掌。
引拍：非持拍手推动球拍向后，拍头高于手腕；用肩膀转动带动引拍（不只用手臂）；双手反拍左肘贴近身体；单反拍面稍关闭。
击球：身体前方（约髋部高度）；手腕固定，拍面垂直地面；重心从后脚转移到前脚；单反伸直手臂；双手反拍上侧手发力主导。
随挥：继续向前推送，拍头随挥至肩部以上；双手反拍收拍过高易失误；非持拍手接住拍颈制动还原。
常见错误：①引拍过晚只能捞球 ②手腕松动掉拍头或翻腕 ③重心后仰、击球点过高。
肘角参考：双手引拍 120–140° / 击球 130–150° / 随挥 100–130°；单反各段大约再大 20°。"""


def _card_volley_fh() -> str:
    return """【截击正手】
准备：大陆式握拍（锤子握法），食指稍分开扣拍柄；双膝微屈，重心在前脚掌；非持拍手轻托拍喉，拍头高于手腕，拍面半开；胸口对准来球。
引拍：幅度极小，不超过身体右侧后方；右肩向后转带动球拍后拉，拍头略高于手腕；非持拍手向左前方伸出「指认」来球。
击球：击球点在身体右前方 45–60cm（比底线正手更靠前）；高度胸口到腰部，太低则屈膝；异侧脚（左脚）向前跨出成弓步；手腕锁死，拍面微开（80–85 度）；前臂微内旋，从高到低向前下方短促推压（20–30cm）；力量源于重心前移和转髋，不挥大臂。
随挥：拍头走向前下方，不超过身体正面一尺；非持拍手接拍颈制动。
隐蔽细节：拍头始终高于手腕；脚步是「跨」不是「迈」；眼睛盯球到拍面；球快借力，球慢主动迎击。"""


def _card_volley_bh() -> str:
    return """【截击反手】
准备：大陆式握拍，拇指直贴拍柄背面；双膝微屈，重心在前脚掌；非持拍手轻托拍喉，拍头高于手腕，拍面半开。
引拍：幅度比正手截击更小，拍柄末端只转到左胯前方；右肩向后转动带动球拍后拉；非持拍手向右后方伸展，强制充分转肩。
击球：击球点在身体左前方 40–50cm，胸口到腰部高度；左脚向右前方跨出成弓步；手腕锁死，拍面约 75–80 度（比正手更关闭）；前臂微外旋，从高到低向前下方短促「切砍」（约 20cm）；肘关节保持微屈（约 150 度），不伸直。
随挥：拍头走向前下方，不超过身体左侧一尺；非持拍手接拍颈制动。
专属细节：拍面比正手更关闭；肘关节保持微屈；左脚向左前方 45 度跨步；高球用「磕挡」，不挥拍。"""


def _card_slice_fh() -> str:
    return """【正手切削】
准备与握拍：大陆式握拍（像握菜刀）；关闭式或半开放式站位，右肩对准球网；非持拍手轻扶拍喉，双膝微屈。
引拍：球拍举高至右肩上方（齐耳高度），拍头指向天空，拍面微打开；非持拍手向后伸展保持平衡，重心在右脚；引拍路径像在身侧画「C」字。
击球：击球点在身体右前方，约腰部高度；重心从右脚转移到左脚，左脚向右前方跨出；拍面打开约 45 度，手腕锁死；拍头从右肩高度向左膝前方陡峭斜线劈砍；力量源自重心前移和肩部转动。
随挥：拍头随挥至左膝外侧，拍面朝下；非持拍手接拍颈制动；随挥必须完整。"""


def _card_slice_bh() -> str:
    return """【反手切削】
准备与握拍：大陆式握拍，拇指直贴拍柄背面；关闭式站位，右肩对准球网，重心在右脚。
引拍：球拍举高至左肩上方，拍头指向天空，拍面打开；非持拍手扶拍喉协助引拍，左肩向后充分转动；引拍路径是直线向后上方（非 C 字）。
击球：击球点在身体左前方，腰部到胸部之间；重心从右脚转移到左脚，右脚向左前方跨出；拍面打开约 45–50 度（比正手稍开），手腕锁死；拍头从左肩高度向右膝前方较平缓斜线推切；强调向前推送多于向下劈砍。
随挥：拍头随挥至右膝外侧，拍面朝下；随挥方向更偏向前方；非持拍手接拍颈制动，随挥后保持侧身。
专属细节：非持拍手全程扶拍直到击球前；拍面比正手更开 5 度；向前推送多于向下劈砍；随挥后保持侧身利于回位。"""


def _card_serve() -> str:
    return """【发球】
三种对比：平击=最高点（12 点）后向前直线撞击，低平前冲快；侧旋=偏右（2 点）右向左摩擦，弹跳低外拐；侧上旋=偏左（10 点）下向上提拉，弹跳高前冲猛。
准备：侧身时左肩对准球网。
平击：大陆式，拍面几乎垂直；抛球头顶正上方偏右略靠前；拍头从背后直线向前上方撞击球中后部；手腕内旋。
侧旋：大陆式，拍面略打开；抛球头顶右侧；拍头从右向左摩擦球右侧；肘部抬高，拍头在手腕上方划过。
侧上旋：大陆式，拍面稍关闭；抛球头顶左侧后方甚至头后；拍头从下向上猛烈提拉球左上侧；背弓拉开，肘部指向天空。
实战：Deuce 侧侧上旋外角压反手 / 平击内角追身；Ad 侧侧旋外角拉开正手 / 平击内角压反手；二发以侧上旋为主。"""


def _card_smash() -> str:
    return """【高压球】
准备与侧身：对方挑高球后立刻侧身转肩，左肩对准来球；非持拍手上举指球（像瞄准镜）；后交叉步或侧滑步快速后退；绝不仰头后退，必须侧身跑动。
引拍：非持拍手继续指球；持拍手自然下垂「挠背」姿势（拍头朝下，肘部朝上）；引拍幅度比发球更小。
击球：身体正上方偏右前，手臂几乎伸直的最高点；重心后脚到前脚；手腕内旋，拍面垂直撞击球后上部；「用指尖去够天花板」。
随挥：拍头向前下方挥动至身体对侧下方；非持拍手接拍颈制动。
细节：非持拍手全程指球；小碎步调整，球落点在右肩正上方；球浅向前迎，球深后退打；拍面微开约 80 度，手腕锁死。
易错：下网→击球点太低/拍面过闭→后退半步拍面打开；出底线→手腕翻动/身体后仰→手腕内旋固定、重心前压；打不到甜区→非持拍手没指球。"""


def _scope() -> str:
    return """写给练球的人看。涨球教练按八项技术要领对应章节点评当前击球（底线正手/反手、截击正手/反手、正手/反手切削、发球、高压）；用户说「正手上旋」用底线正手章节。
只使用与本条视频匹配的章节；看不清的细节直接跳过。不要另起体系，不要在报告里解释评价范围或拍摄规范。"""


def _observability() -> str:
    return """【画面能看什么 / 看不准什么】
能看：屈膝和步幅、转肩还是只动手、击球点相对身体、挥拍先落还是横扫、随挥过肩还是上拎、重心起伏、是否跳起、肘角大致范围。
很难看准：掌心钟表方向、握拍（大陆式）、拍面精确开合、前臂内旋、甜区。看不清就写「拍头偏后下方 / 拍面朝侧面 / 轨迹横扫」，不要编 6:00。
slot_drop、body_turn、weight_shift、tech_flags 是 2D 旁证，必须和附图对照；旁证和画面打架时以画面为准。
背景杂乱时只认骨架和球拍框，不要把旁边的人当球员。"""


_CARD_BY_KIND = {
    "forehand": _card_forehand,
    "backhand": _card_backhand,
    "volley_fh": lambda _w=None: _card_volley_fh(),
    "volley_bh": lambda _w=None: _card_volley_bh(),
    "forehand_slice": lambda _w=None: _card_slice_fh(),
    "backhand_slice": lambda _w=None: _card_slice_bh(),
    "serve": lambda _w=None: _card_serve(),
    "smash": lambda _w=None: _card_smash(),
}


def prompt_knowledge(clip_ids: list[str], handed: str = "right", player_level: str = "3.0") -> str:
    w = _side_words(handed if handed in ("left", "right") else "right")
    wanted = {normalize_kind(i) for i in clip_ids if i}
    parts: list[str] = [prompt_level_block(player_level), _scope()]
    if not wanted:
        wanted = {"forehand"}
    for kind in (
        "forehand",
        "backhand",
        "forehand_slice",
        "backhand_slice",
        "volley_fh",
        "volley_bh",
        "serve",
        "smash",
    ):
        if kind not in wanted:
            continue
        card = _CARD_BY_KIND[kind]
        parts.append(card(w) if kind in ("forehand", "backhand") else card())
    parts.append(_observability())
    return "\n\n".join(parts)


def resolve_technique_intent(text: str) -> str | None:
    """Map natural language (e.g. 正手上旋) onto pipeline stroke kinds / eight-technique ids."""
    blob = (text or "").strip()
    if not blob:
        return None
    checks = (
        ("forehand_slice", r"正手切削|fh-slice|forehand slice"),
        ("backhand_slice", r"反手切削|bh-slice|backhand slice"),
        ("volley_fh", r"截击正手|正手截击|fh-volley|forehand volley"),
        ("volley_bh", r"截击反手|反手截击|bh-volley|backhand volley"),
        ("smash", r"高压球|高压|smash|overhead"),
        ("serve", r"发球|一发|二发|\bserve\b"),
        ("backhand", r"反手上旋|底线反手|反手|backhand|bh-topspin"),
        ("forehand", r"正手上旋|底线正手|正手|forehand|topspin|fh-topspin"),
    )

    for kind, pat in checks:
        if re.search(pat, blob, re.I):
            return kind
    return None
