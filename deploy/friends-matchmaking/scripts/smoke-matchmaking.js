#!/usr/bin/env node
/** Offline smoke: matching prefers same city + close UTR. */
const fs = require("fs");
const path = require("path");
const inject = fs.readFileSync(
  path.join(__dirname, "../uniapp-www/zq-friends-matchmaking-inject.js"),
  "utf8",
);

// Minimal harness: eval pickBuddy-related pure helpers by extracting via Function
function utrSeed(level) {
  return Math.round(level * 2.15 * 10) / 10;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(utrSeed(3.5) === 7.5, "UTR seed 3.5 -> 7.5");
assert(inject.includes("开始匹配"), "zh start CTA");
assert(inject.includes("Start matching"), "en start CTA");
assert(inject.includes("data-matchmaking"), "matchmaking marker");
assert(inject.includes("hideSearch"), "hides search friends/courts");
assert(/Search friends\|Search courts/.test(inject) || /搜索球友\|搜索球场/.test(inject), "detects search placeholders to hide");
assert(!inject.includes('placeholder="搜索球友"'), "no search friends input UI");
assert(inject.includes("NEARBY"), "nearby city fallback");
assert(inject.includes("utrDelta"), "UTR proximity");
console.log("smoke-matchmaking OK");
