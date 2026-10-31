export type CameraSetupMode = "standard" | "ground";

export type CameraTip = { key: string; label: string; text: string };

export function cameraSetupCopy(zh: boolean) {
  return {
    title: zh ? "录制前：摄像头架设" : "Before recording: camera setup",
    subtitle: zh
      ? "摆好机位再开始，球速、落点与线审更稳。"
      : "Frame the court first for steadier speed, depth, and line calls.",
    duringTitle: zh ? "录制中请保持" : "While recording",
    during: zh
      ? "手机固定、勿遮挡；尽量飞行模式避免来电打断。整场都要看到双侧底线。"
      : "Keep the phone locked; avoid blocking the lens. Prefer airplane mode. Keep both baselines in view the whole session.",
    standardTitle: zh ? "标准机位（围网或三脚架）" : "Standard (fence or tripod)",
    groundTitle: zh ? "地面模式（手机放地上）" : "Ground mode (phone on the ground)",
    items: (zh
      ? [
          { key: "height", label: "高度", text: "尽量架高（围网顶端最佳），但别让球网挡住远端底线。" },
          { key: "distance", label: "距离", text: "放在底线后方、靠近场地中线；单打可略偏弱侧约一脚，减少挡球。" },
          { key: "angle", label: "角度", text: "整片场地入镜：两侧底线及线后约 1–2 米；略俯拍，近端发球线落在画面偏下。" },
          { key: "net", label: "球网与底线", text: "球网顶边尽量不要压住远端发球线或底线；画面居中对齐场地。" },
          { key: "light", label: "光线与挡风网", text: "太阳在手机背后一侧；尽量对着没有挡风网的一侧。" },
        ]
      : [
          { key: "height", label: "Height", text: "Mount as high as practical (fence-top preferred) without the net covering the far baseline." },
          { key: "distance", label: "Distance", text: "Behind the baseline near center; for singles, offset about one foot toward the weaker side so players block less." },
          { key: "angle", label: "Angle", text: "Fit the whole court: both baselines plus a few feet behind each; tilt down so the near service line sits in the lower third." },
          { key: "net", label: "Net and baseline", text: "Avoid the net tape overlapping the far service or baseline; keep the court centered." },
          { key: "light", label: "Light and windscreen", text: "Sun behind the phone; prefer the side without a windscreen." },
        ]) as CameraTip[],
    groundItems: (zh
      ? [
          { key: "prop", label: "支撑", text: "在底线后中场附近放水瓶（或稳定物），手机斜靠其上。" },
          { key: "aim", label: "取景", text: "俯仰到球网白边落在取景提示框内；能看到双侧底线与线后空间。" },
          { key: "stable", label: "稳定", text: "确认不会被风吹倒；开录前再看一眼是否整场可见。" },
        ]
      : [
          { key: "prop", label: "Prop", text: "Place a water bottle (or stable object) on the ground near mid-court behind the baseline; lean the phone against it." },
          { key: "aim", label: "Framing", text: "Tilt until the net tape sits in the guide box; keep both baselines and a bit of space behind them visible." },
          { key: "stable", label: "Stable", text: "Make sure wind will not tip it; double-check the full court before you start." },
        ]) as CameraTip[],
    ready: zh ? "确认机位，开始录制" : "Framing looks good — start",
    review: zh ? "查看架设要点" : "Review setup tips",
    dismiss: zh ? "知道了" : "Got it",
    groundChip: zh ? "地面模式" : "Ground mode",
    standardChip: zh ? "标准机位" : "Standard",
  };
}
