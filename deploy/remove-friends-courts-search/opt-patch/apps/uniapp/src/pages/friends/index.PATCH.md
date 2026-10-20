# `apps/uniapp/src/pages/friends/index.vue`

Same product rule as web: remove “Search friends or courts” / “搜索球友或球场”.

## Remove

- Search `<input>` / `<uni-search-bar>` / placeholder bound to search copy
- Client filter over friends/courts by query
- Result-count line that only exists for search (`{n} results`)

## Keep

- Friends list + local ladder if present
- Friend detail / invite if not solely a search dead-end

WeChat `mp-weixin` thin package in this repo has **no** friends/courts pages; regenerating the zip documents that.
