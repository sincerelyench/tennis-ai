# 涨球教练 · 八项技术分步带练

把 [八项技术要领](../../docs 见 Agent Store) 接到涨球教练问答 / 练习引导：用户说想学某动作（如「正手上旋」）时，映射到对应章节并按 准备→引拍→击球→随挥→动力链→常见错误（该章适用项）分步带练。

## 映射

| 自然语言 | 章节 / strokeId |
| --- | --- |
| 正手上旋 / 底线正手 | 底线正手 · `fh-topspin` |
| 反手上旋 / 底线反手 | 底线反手 · `bh-topspin` |
| 正手截击 / 截击正手 | 截击正手 · `fh-volley` |
| 反手截击 / 截击反手 | 截击反手 · `bh-volley` |
| 正手切削 | 正手切削 · `fh-slice` |
| 反手切削 | 反手切削 · `bh-slice` |
| 发球 | 发球 · `serve` |
| 高压 / 高压球 | 高压球 · `smash` |

## 应用到 `/opt/tennis-ai`

```bash
bash deploy/coach-eight-techniques/scripts/apply-on-server.sh /opt/tennis-ai
```

会写入：

- `lib/eight-techniques.ts` — canon + intent + drill
- `lib/coach.ts` / `lib/coach-roster.ts` / `lib/network-coach-persona.ts`
- `app/api/coach/chat/route.ts` — 注入章节 + 返回 `drill`
- `components/coach-view.tsx` — 分步练习卡 +「我想学正手上旋」等 chips
- 种子动作库 prompt（空条目才填充）
- `public/coach-eight-techniques.html` 预览

## 验证

- Web：`https://yqchen.blog/tennis/coach`（中文 locale）点「我想学正手上旋」
- Preview：`https://yqchen.blog/tennis/coach-eight-techniques.html`
- APK / IPA / mp-weixin 壳打开同一 Web 源；无原生教练 UI 变更时不必重打壳
