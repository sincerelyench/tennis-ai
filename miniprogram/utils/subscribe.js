const api = require("./api")
const config = require("../config")
const session = require("./session")

const EVENTS = [
  "ladder",
  "invite",
  "invite_accepted",
  "score_confirm",
  "message",
]

function localTmplMap() {
  const raw = (config && config.subscribeTemplates) || {}
  const out = {}
  for (const ev of EVENTS) {
    const id = String(raw[ev] || "").trim()
    if (id && id.indexOf("REPLACE_") !== 0) out[ev] = id
  }
  return out
}

function fetchServerTemplates(token) {
  return api
    .wechatSubscribeConfig(token)
    .then((body) => {
      const templates = (body && body.templates) || {}
      const out = {}
      for (const ev of EVENTS) {
        const id = String(templates[ev] || "").trim()
        if (id) out[ev] = id
      }
      return out
    })
    .catch(() => ({}))
}

function mergeTemplates(serverMap) {
  return Object.assign({}, localTmplMap(), serverMap || {})
}

function reportAccepts(token, byTemplateId, eventResults) {
  if (!token) return Promise.resolve()
  return api
    .reportWechatSubscribe(token, {
      byTemplateId: byTemplateId || {},
      results: eventResults || {},
    })
    .catch(() => null)
}

/**
 * Request subscribe for the given events (or all configured).
 * Must run in a user-gesture callback (tap).
 * Returns Promise<{ ok, results, skipped? }>
 */
function requestSubscribe(events) {
  const auth = session.auth()
  const token = auth && auth.token
  const wanted = Array.isArray(events) && events.length ? events : EVENTS.slice()

  return fetchServerTemplates(token).then((serverMap) => {
    const templates = mergeTemplates(serverMap)
    const tmplIds = []
    const idToEvent = {}
    for (const ev of wanted) {
      const id = templates[ev]
      if (!id) continue
      if (tmplIds.indexOf(id) === -1) tmplIds.push(id)
      idToEvent[id] = ev
    }
    if (!tmplIds.length) {
      return {
        ok: false,
        skipped: true,
        reason: "no_template_ids",
        results: {},
      }
    }
    return new Promise((resolve) => {
      wx.requestSubscribeMessage({
        tmplIds: tmplIds.slice(0, 5),
        success(res) {
          const byTemplateId = {}
          const eventResults = {}
          for (const id of tmplIds) {
            const status = res && res[id]
            if (status) {
              byTemplateId[id] = status
              const ev = idToEvent[id]
              if (ev) eventResults[ev] = status
            }
          }
          reportAccepts(token, byTemplateId, eventResults).then(() => {
            resolve({ ok: true, results: eventResults, byTemplateId })
          })
        },
        fail(err) {
          resolve({
            ok: false,
            error: (err && (err.errMsg || err.message)) || "requestSubscribeMessage failed",
            results: {},
          })
        },
      })
    })
  })
}

module.exports = {
  EVENTS,
  requestSubscribe,
  localTmplMap,
}
