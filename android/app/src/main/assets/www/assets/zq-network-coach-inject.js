/*! 涨球 · 教练 tab：涨球教练=AI 即时问答；网络教练=真人留言（非同一套即时问答 UI） */
(function () {
  var MARK = "data-zq-network-coach-inject";
  var STYLE_ID = "zq-network-coach-style";
  var SEL_KEY = "tennis-player-selected-coach-v1";
  var PUB_KEY = "tennis-coach-publish-v1";
  var CHAT_KEY = "tennis-ai-coach-chat";
  var MSG_KEY = "tennis-network-coach-messages-v1";
  var LIB_KEY = "tennis-coach-stroke-library-v1";
  var API = [
    "https://yqchen.blog/tennis/api/coach/chat",
    "/tennis/api/coach/chat",
  ];

  function zh() {
    try {
      var loc = localStorage.getItem("tennis-locale") || "";
      if (loc === "en") return false;
      if (loc === "zh" || loc === "zh-CN") return true;
    } catch (e) {}
    return (navigator.language || "").toLowerCase().indexOf("zh") === 0;
  }

  function isCoachPage() {
    var href = location.href || "";
    return /pages\/coach\/index/i.test(href) || /#\/pages\/coach/i.test(href) || /\/tennis\/coach/i.test(href);
  }

  function scrubPoppy(name) {
    var raw = String(name || "").trim();
    if (!raw || /poppy|东东|dongdong|掌球/i.test(raw)) return zh() ? "涨球教练" : "Zhangqiu Coach";
    return raw.slice(0, 40);
  }

  function isAiCoach(id) {
    return !id || id === "poppy" || id === "zhangqiu";
  }

  function readSelectedNetwork() {
    var id = "";
    try {
      id = localStorage.getItem(SEL_KEY) || "";
    } catch (e) {}
    if (!id || isAiCoach(id)) return null;
    var name = zh() ? "网络教练" : "Network coach";
    var style = "";
    try {
      var pub = JSON.parse(localStorage.getItem(PUB_KEY) || "{}");
      var card = pub[id];
      if (card && card.status === "published") {
        name = scrubPoppy(card.displayName) || name;
        style = String(card.styleTagline || "");
      }
    } catch (e) {}
    return { id: id, name: name, style: style };
  }

  function readMessages(coachId) {
    try {
      var all = JSON.parse(localStorage.getItem(MSG_KEY) || "{}");
      var list = all[coachId];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeMessages(coachId, list) {
    try {
      var all = JSON.parse(localStorage.getItem(MSG_KEY) || "{}");
      all[coachId] = list.slice(-40);
      localStorage.setItem(MSG_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  function ensureSeedNetwork() {
    try {
      var sel = localStorage.getItem(SEL_KEY);
      var pub = JSON.parse(localStorage.getItem(PUB_KEY) || "{}");
      if (!pub.lin_kai || pub.lin_kai.status !== "published") {
        pub.lin_kai = {
          coachId: "lin_kai",
          displayName: zh() ? "林凯教练" : "Coach Lin Kai",
          styleTagline: zh() ? "底线对抗 · 脚步先行" : "Baseline battle · feet first",
          status: "published",
          publishedAt: new Date().toISOString(),
          libraryStrokeCount: 2,
        };
        localStorage.setItem(PUB_KEY, JSON.stringify(pub));
      }
      if (!sel || sel === "poppy") {
        localStorage.setItem(SEL_KEY, "lin_kai");
      }
      var lib = JSON.parse(localStorage.getItem(LIB_KEY) || "{}");
      if (!lib.lin_kai) {
        lib.lin_kai = {
          coachId: "lin_kai",
          entries: {
            "fh-topspin": {
              strokeId: "fh-topspin",
              prompt: zh()
                ? "林凯：先用小碎步调整站位，再送拍；击球点在身前一个球的距离。"
                : "Lin: split-step first, then send the racket; contact a ball’s length in front.",
            },
          },
        };
        localStorage.setItem(LIB_KEY, JSON.stringify(lib));
      }
    } catch (e) {}
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".zq-nc-wrap{margin:8px 12px 12px;padding:12px;border-radius:14px;border:1px solid #d7e3dc;background:linear-gradient(180deg,#f7fbf8,#fff);font-family:PingFang SC,Noto Sans SC,sans-serif;color:#14201a}" +
      ".zq-nc-brand{font-size:11px;font-weight:800;color:#1f7a4c;letter-spacing:.02em}" +
      ".zq-nc-title{font-size:15px;font-weight:800;margin:4px 0 8px}" +
      ".zq-nc-lead{font-size:12px;color:#5b6b63;line-height:1.45;margin:0 0 8px}" +
      ".zq-nc-row{display:flex;gap:8px;flex-wrap:wrap}" +
      ".zq-nc-chip{flex:1;min-width:42%;border:1px solid #d7e3dc;border-radius:12px;padding:10px;background:#fff;text-align:left;cursor:pointer}" +
      ".zq-nc-chip.on{border-color:#1f7a4c;background:#eef8f2}" +
      ".zq-nc-chip b{display:block;font-size:13px}" +
      ".zq-nc-chip span{display:block;margin-top:4px;font-size:11px;color:#1f7a4c;font-weight:700}" +
      ".zq-nc-chip i{display:block;margin-top:4px;font-size:11px;color:#5b6b63;font-style:normal}" +
      ".zq-nc-link{margin-top:8px;font-size:12px;font-weight:700;color:#1f7a4c;background:none;border:0;padding:0;cursor:pointer}" +
      ".zq-nc-log{margin-top:10px;max-height:240px;overflow:auto;display:flex;flex-direction:column;gap:8px}" +
      ".zq-nc-bubble{max-width:88%;padding:8px 10px;border-radius:12px;font-size:13px;line-height:1.45}" +
      ".zq-nc-bubble.user{align-self:flex-end;background:#1f7a4c;color:#fff}" +
      ".zq-nc-bubble.coach{align-self:flex-start;background:#fff;border:1px solid #d7e3dc}" +
      ".zq-nc-note{align-self:stretch;max-width:100%;padding:8px 10px;border-radius:10px;background:#f3f7f4;border:1px dashed #c9d9cf;font-size:12px;color:#5b6b63;line-height:1.45}" +
      ".zq-nc-msg{align-self:stretch;border:1px solid #d7e3dc;border-radius:12px;background:#fff;padding:10px}" +
      ".zq-nc-msg .meta{font-size:11px;color:#5b6b63;font-weight:700}" +
      ".zq-nc-msg .body{margin-top:6px;font-size:13px;line-height:1.45;color:#14201a}" +
      ".zq-nc-msg .status{margin-top:6px;font-size:11px;color:#1f7a4c;font-weight:700}" +
      ".zq-nc-form{display:flex;gap:8px;margin-top:10px}" +
      ".zq-nc-form input,.zq-nc-form textarea{flex:1;border:1px solid #d7e3dc;border-radius:10px;padding:10px;font:inherit;resize:vertical;min-height:42px}" +
      ".zq-nc-form button{border:0;border-radius:10px;padding:10px 14px;background:#1f7a4c;color:#fff;font-weight:700;align-self:flex-end}" +
      ".zq-nc-form button:disabled{opacity:.45}" +
      ".zq-nc-hint{font-size:11px;color:#5b6b63;margin-top:6px}" +
      ".zq-nc-empty{font-size:12px;color:#5b6b63;padding:8px 0}";
    document.head.appendChild(s);
  }

  function activeId() {
    try {
      return localStorage.getItem(CHAT_KEY) || "poppy";
    } catch (e) {
      return "poppy";
    }
  }

  function setActive(id) {
    try {
      localStorage.setItem(CHAT_KEY, id);
    } catch (e) {}
  }

  var state = {
    coachId: "poppy",
    pending: false,
    history: [],
    messages: [],
    board: [],
  };

  function tCopy() {
    if (zh()) {
      return {
        brand: "涨球",
        title: "我的教练",
        lead: "涨球教练是 AI 即时问答；网络教练是平台真人，用留言沟通。",
        zq: "涨球教练",
        zqHint: "AI 教练 · 即时问答",
        zqOn: "正在问答",
        netHint: "真人教练 · 留言",
        netOn: "留言中",
        pick: "选教练",
        change: "更换网络教练",
        phAi: "问问涨球教练…",
        phNet: "给教练留言…",
        send: "发送",
        leave: "留言",
        helloZq: "我是涨球教练（AI）。一次一条提示，先把击球点送到身前。",
        boardIntro: function (n) {
          return n + "是平台真人教练。请留言，教练会择时回复——不是即时 AI 问答。";
        },
        waiting: "已留言，等待教练回复",
        emptyBoard: "还没有留言。写一条技术问题或训练反馈吧。",
        fail: "暂时连不上 AI 教练服务，请稍后重试。",
        pickHint: "在「选教练」里选择已发布的网络教练后，可在此留言。",
        modeAi: "AI 问答",
        modeNet: "真人留言板",
      };
    }
    return {
      brand: "涨球",
      title: "My coaches",
      lead: "Zhangqiu Coach is AI chat; network coaches are real people via messages.",
      zq: "Zhangqiu Coach",
      zqHint: "AI coach · Instant Q&A",
      zqOn: "Chatting",
      netHint: "Human coach · Messages",
      netOn: "Messaging",
      pick: "Choose coach",
      change: "Change network coach",
      phAi: "Ask Zhangqiu Coach…",
      phNet: "Leave a message…",
      send: "Send",
      leave: "Leave message",
      helloZq: "I’m Zhangqiu Coach (AI). One cue at a time — meet the ball out front.",
      boardIntro: function (n) {
        return n + " is a real platform coach. Leave a message — they reply later, not instant AI chat.";
      },
      waiting: "Sent — waiting for coach reply",
      emptyBoard: "No messages yet. Leave a technique question or training note.",
      fail: "AI coach service unreachable. Try again shortly.",
      pickHint: "Pick a published network coach, then leave messages here.",
      modeAi: "AI chat",
      modeNet: "Human message board",
    };
  }

  function openPicker() {
    if (/yqchen\.blog|\/tennis\//i.test(location.href) && !/#\/pages\//i.test(location.href)) {
      location.assign("/tennis/coaches");
      return;
    }
    location.hash = "#/pages/coach-picker/coach-picker";
  }

  async function sendAiChat(text) {
    var c = tCopy();
    if (state.pending) return;
    state.pending = true;
    render();
    var userMsg = { role: "user", content: text };
    state.history = state.history.concat([userMsg]);
    state.messages = state.messages.concat([{ role: "user", text: text }]);
    render();

    var body = {
      messages: state.history.slice(-20),
      confirmedDaily: true,
      confirmedImprove: false,
      coachId: "poppy",
      locale: zh() ? "zh-CN" : "en",
    };
    var ok = false;
    var reply = "";
    for (var i = 0; i < API.length; i++) {
      try {
        var res = await fetch(API[i], {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        var data = await res.json().catch(function () {
          return null;
        });
        if (res.ok && data && data.text) {
          reply = data.text;
          ok = true;
          break;
        }
      } catch (e) {}
    }
    if (!ok) {
      reply = zh()
        ? "涨球教练：关于「" + text.slice(0, 40) + "」——先把击球点再往身前送一个拍头。"
        : 'Zhangqiu Coach: On "' + text.slice(0, 40) + '" — meet it farther in front.';
    }
    state.history = state.history.concat([{ role: "assistant", content: reply }]);
    state.messages = state.messages.concat([{ role: "coach", text: reply }]);
    state.pending = false;
    render();
  }

  function leaveNetworkMessage(text) {
    var net = readSelectedNetwork();
    if (!net) return;
    var item = {
      id: Date.now(),
      text: text,
      at: new Date().toISOString(),
      status: "pending",
    };
    state.board = state.board.concat([item]);
    writeMessages(net.id, state.board);
    render();
  }

  function switchCoach(id) {
    state.coachId = id;
    setActive(id);
    state.history = [];
    state.messages = [];
    state.board = [];
    var c = tCopy();
    var net = readSelectedNetwork();
    if (isAiCoach(id)) {
      state.messages = [{ role: "coach", text: c.helloZq }];
      state.history = [{ role: "assistant", content: c.helloZq }];
    } else {
      state.board = readMessages(id);
    }
    render();
  }

  function formatTime(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString(zh() ? "zh-CN" : "en-US", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  }

  function render() {
    ensureStyle();
    ensureSeedNetwork();
    var host = document.querySelector("[" + MARK + "]");
    if (!host) {
      host = document.createElement("div");
      host.setAttribute(MARK, "1");
      var app = document.getElementById("app") || document.body;
      if (app.firstChild) app.insertBefore(host, app.firstChild);
      else app.appendChild(host);
    }
    var c = tCopy();
    var net = readSelectedNetwork();
    var onAi = isAiCoach(state.coachId);
    var html =
      '<div class="zq-nc-wrap" data-network-coach-chat="true" data-coach-mode="' +
      (onAi ? "ai-chat" : "human-message") +
      '">' +
      '<div class="zq-nc-brand">' +
      c.brand +
      "</div>" +
      '<div class="zq-nc-title">' +
      c.title +
      "</div>" +
      '<p class="zq-nc-lead">' +
      c.lead +
      "</p>" +
      '<div class="zq-nc-row" data-coach-chat-personas="true">' +
      '<button type="button" class="zq-nc-chip' +
      (onAi ? " on" : "") +
      '" data-coach-id="poppy" data-coach-kind="zhangqiu" data-coach-selected="' +
      (onAi ? "true" : "false") +
      '"><b data-coach-name="true">' +
      c.zq +
      "</b><span>" +
      (onAi ? c.zqOn : c.zqHint) +
      "</span></button>" +
      (net
        ? '<button type="button" class="zq-nc-chip' +
          (!onAi ? " on" : "") +
          '" data-coach-id="' +
          net.id +
          '" data-coach-kind="network" data-coach-selected="' +
          (!onAi ? "true" : "false") +
          '"><b data-coach-name="true">' +
          net.name +
          "</b><span>" +
          (!onAi ? c.netOn : c.netHint) +
          "</span>" +
          (net.style ? "<i>" + net.style + "</i>" : "") +
          "</button>"
        : "") +
      "</div>" +
      '<button type="button" class="zq-nc-link" data-action="open-coach-picker">' +
      (net ? c.change : c.pick) +
      "</button>" +
      (!net ? '<p class="zq-nc-hint">' + c.pickHint + "</p>" : "") +
      (onAi
        ? '<div class="zq-nc-log" data-coach-panel="ai-chat"></div>' +
          '<form class="zq-nc-form" data-coach-composer="ai">' +
          '<input type="text" maxlength="500" placeholder="' +
          c.phAi +
          '" />' +
          '<button type="submit"' +
          (state.pending ? " disabled" : "") +
          ">" +
          c.send +
          "</button></form>"
        : '<div class="zq-nc-note" data-coach-panel="human-intro">' +
          c.boardIntro(net ? net.name : scrubPoppy("")) +
          "</div>" +
          '<div class="zq-nc-log" data-coach-panel="human-board"></div>' +
          '<form class="zq-nc-form" data-coach-composer="message">' +
          '<textarea maxlength="500" rows="2" placeholder="' +
          c.phNet +
          '"></textarea>' +
          '<button type="submit">' +
          c.leave +
          "</button></form>");
    host.innerHTML = html + "</div>";

    var log = host.querySelector(".zq-nc-log");
    if (onAi) {
      state.messages.forEach(function (m) {
        var d = document.createElement("div");
        d.className = "zq-nc-bubble " + (m.role === "user" ? "user" : "coach");
        d.textContent = m.text;
        log.appendChild(d);
      });
    } else {
      if (!state.board.length) {
        var empty = document.createElement("div");
        empty.className = "zq-nc-empty";
        empty.textContent = c.emptyBoard;
        log.appendChild(empty);
      } else {
        state.board.forEach(function (m) {
          var card = document.createElement("div");
          card.className = "zq-nc-msg";
          card.setAttribute("data-message-id", String(m.id));
          card.innerHTML =
            '<div class="meta">' +
            formatTime(m.at) +
            "</div>" +
            '<div class="body"></div>' +
            '<div class="status">' +
            c.waiting +
            "</div>";
          card.querySelector(".body").textContent = m.text;
          log.appendChild(card);
        });
      }
    }
    log.scrollTop = log.scrollHeight;

    host.querySelectorAll(".zq-nc-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchCoach(btn.getAttribute("data-coach-id") || "poppy");
      });
    });
    var pick = host.querySelector('[data-action="open-coach-picker"]');
    if (pick) pick.addEventListener("click", openPicker);
    var form = host.querySelector("form");
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var input = form.querySelector("input,textarea");
      var val = (input.value || "").trim();
      if (!val || state.pending) return;
      input.value = "";
      if (isAiCoach(state.coachId)) sendAiChat(val);
      else leaveNetworkMessage(val);
    });
  }

  function boot() {
    if (!isCoachPage()) {
      var stale = document.querySelector("[" + MARK + "]");
      if (stale) stale.remove();
      return;
    }
    ensureSeedNetwork();
    state.coachId = activeId();
    if (isAiCoach(state.coachId)) {
      if (!state.messages.length) switchCoach(state.coachId);
      else render();
    } else {
      state.board = readMessages(state.coachId);
      render();
    }
  }

  var last = "";
  setInterval(function () {
    var href = location.href;
    if (href !== last) {
      last = href;
      boot();
    } else if (isCoachPage() && !document.querySelector("[" + MARK + "]")) {
      boot();
    }
  }, 700);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
