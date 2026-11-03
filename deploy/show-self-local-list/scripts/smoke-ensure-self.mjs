/** Quick smoke for ensureSelfInPlayers + city filter semantics (no Next runtime). */
function playersFromDirectory(users) {
  const out = [];
  for (const u of users) {
    const name = String(u.displayName || u.name || "").trim();
    if (!name) continue;
    out.push({
      id: String(u.id),
      name,
      ntrp: Number(u.level ?? 3.5),
      cityId: String(u.cityId || "").trim() || "unknown",
    });
  }
  return out;
}

function ensureSelfInPlayers(players, self) {
  const name = String(self?.displayName || self?.name || "").trim();
  const cityId = String(self?.cityId || "").trim();
  if (!name || !cityId) return players.slice();
  const id = String(self?.id || self?.phone || "").trim() || `self:${name}`;
  const rest = players.filter((p) => p.id !== id && p.name !== name);
  return [...rest, { id, name, ntrp: self.level ?? 3.5, cityId }];
}

function rateScoped(players, cityId) {
  return players.filter((p) => p.cityId === cityId);
}

const directory = playersFromDirectory([
  { id: "13800138888", displayName: "测试球友甲", cityId: "wuxi", level: 3.5 },
]);
const aloneWrongCity = rateScoped(directory, "tokyo");
console.assert(aloneWrongCity.length === 0, "precondition: wrong city hides self");

const fixed = ensureSelfInPlayers(directory, {
  phone: "13800138888",
  name: "测试球友甲",
  level: 3.5,
  cityId: "tokyo",
});
const aloneOk = rateScoped(fixed, "tokyo");
console.assert(aloneOk.length === 1, "self appears in selected city");
console.assert(aloneOk[0].name === "测试球友甲", "name preserved");

const emptyName = ensureSelfInPlayers([], { phone: "1", name: "", cityId: "tokyo" });
console.assert(emptyName.length === 0, "empty name stays 0");

console.log(
  JSON.stringify(
    {
      ok: true,
      aloneWrongCity: aloneWrongCity.length,
      aloneOk: aloneOk.length,
      emptyName: emptyName.length,
      self: aloneOk[0],
    },
    null,
    2,
  ),
);
