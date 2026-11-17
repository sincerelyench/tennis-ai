# ZQ-147 · 排行榜「双打」改为「女单」

## 产品

- 排行榜 Tab 榜面：**单打** + **女单**（暂无双打）
- 女单：把单打榜里的女球员按同一套 UTR 风格等级分重排 1…N
- 比分录入在女单 Tab 下仍记为 **singles**（两榜共用单打成绩）

## 女球员如何识别（ZQ-148）

1. **主信号（权威）**：资料可选「性别」自报（`AuthUser.gender`: `female` | `male`）— 用户本人保存，不强制  
   - `male` → **不进**女单（即使显示名在种子列表）  
   - `female` → 进女单  
2. **兜底（仅 gender 未填时、仅代码、不写库）**：种子显示名 — **陈燕青 / Ivy / Shirley**  
3. **不做**：按姓名猜测、批量改写生产库性别（须燕青同意）；禁止 allowlist OR 盖过显式性别

## 排名规则

1. 用 **singles** 确认比赛重放得到全城单打等级分  
2. 过滤女球员  
3. 按等级分降序重排名次（分数本身不变）

## Apply

```bash
bash deploy/ladder-womens-singles/scripts/apply-on-server.sh /opt/tennis-ai
```

Code only for gender schema field — users may self-report. No bulk gender invent.

## Tests

```bash
python3 -m unittest tests.test_ladder_womens_singles -v
```

## Four-surface

Web deploy. APK / IPA / mp WebView → live `/tennis`.
