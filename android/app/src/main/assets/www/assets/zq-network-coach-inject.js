/*! 涨球 · 教练 tab：涨球教练 + 所选网络教练问答（永不显示 Poppy） */
(function () {
  var MARK = "data-zq-network-coach-inject";
  var STYLE_ID = "zq-network-coach-style";
  var SEL_KEY = "tennis-player-selected-coach-v1";
  var PUB_KEY = "tennis-coach-publish-v1";
  var CHAT_KEY = "tennis-ai-coach-chat";
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

  function readSelectedNetwork() {
    var id = "";
    try {
      id = localStorage.getItem(SEL_KEY) || "";
    } catch (e) {}
    if (!id || id === "poppy" || id === "zhangqiu") return null;
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
    // seed demo network coach if publish store empty but we want dual UI for QA
    if (!name) name = zh() ? "网络教练" : "Network coach";
    return { id: id, name: name, style: style };
  }

  function ensureSeedNetwork() {
    // If player has no selection, seed demo published network coach for local/demo.
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
      ".zq-nc-row{display:flex;gap:8px;flex-wrap:wrap}" +
      ".zq-nc-chip{flex:1;min-width:42%;border:1px solid #d7e3dc;border-radius:12px;padding:10px;background:#fff;text-align:left;cursor:pointer}" +
      ".zq-nc-chip.on{border-color:#1f7a4c;background:#eef8f2}" +
      ".zq-nc-chip b{display:block;font-size:13px}" +
      ".zq-nc-chip span{display:block;margin-top:4px;font-size:11px;color:#1f7a4c;font-weight:700}" +
      ".zq-nc-chip i{display:block;margin-top:4px;font-size:11px;color:#5b6b63;font-style:normal}" +
      ".zq-nc-link{margin-top:8px;font-size:12px;font-weight:700;color:#1f7a4c;background:none;border:0;padding:0;cursor:pointer}" +
      ".zq-nc-log{margin-top:10px;max-height:220px;overflow:auto;display:flex;flex-direction:column;gap:8px}" +
      ".zq-nc-bubble{max-width:88%;padding:8px 10px;border-radius:12px;font-size:13px;line-height:1.45}" +
      ".zq-nc-bubble.user{align-self:flex-end;background:#1f7a4c;color:#fff}" +
      ".zq-nc-bubble.coach{align-self:flex-start;background:#fff;border:1px solid #d7e3dc}" +
      ".zq-nc-form{display:flex;gap:8px;margin-top:10px}" +
      ".zq-nc-form input{flex:1;border:1px solid #d7e3dc;border-radius:10px;padding:10px;font:inherit}" +
      ".zq-nc-form button{border:0;border-radius:10px;padding:10px 14px;background:#1f7a4c;color:#fff;font-weight:700}" +
      ".zq-nc-form button:disabled{opacity:.45}" +
      ".zq-nc-hint{font-size:11px;color:#5b6b63;margin-top:6px}";
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
  };

  function tCopy() {
    if (zh()) {
      return {
        brand: "涨球",
        title: "对话教练",
        zq: "涨球教练",
        zqHint: "平台教练 · 可问答",
        netHint: "网络教练 · 可问答",
        chatting: "当前对话",
        pick: "选教练",
        change: "更换网络教练",
        ph: "问问教练…",
        send: "发送",
        helloZq: "我是涨球教练。一次一条提示，先把击球点送到身前。",
        helloNet: function (n) {
          return "你好，我是" + n + "。可以直接问技术问题，我会按我的风格回答。";
        },
        fail: "暂时连不上教练服务，请稍后重试。",
        pickHint: "在「选教练」里选择已发布的网络教练后，可在此切换问答。",
      };
    }
    return {
      brand: "涨球",
      title: "Chat with coaches",
      zq: "Zhangqiu Coach",
      zqHint: "Platform coach · Q&A",
      netHint: "Network coach · Q&A",
      chatting: "Chatting",
      pick: "Choose coach",
      change: "Change network coach",
      ph: "Ask the coach…",
      send: "Send",
      helloZq: "I’m Zhangqiu Coach. One cue at a time — meet the ball out front.",
      helloNet: function (n) {
        return "Hi, I’m " + n + ". Ask technique questions and I’ll answer in my style.";
      },
      fail: "Coach service unreachable. Try again shortly.",
      pickHint: "Pick a published network coach, then switch here to chat.",
    };
  }

  function openPicker() {
    // Prefer in-app coaches route; fallback hash for uni-app picker page.
    if (/yqchen\.blog|\/tennis\//i.test(location.href) && !/#\/pages\//i.test(location.href)) {
      location.assign("/tennis/coaches");
      return;
    }
    location.hash = "#/pages/coach-picker/coach-picker";
  }

  async function sendChat(text) {
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
      coachId: state.coachId,
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
      // Local fallback so APK/demo still shows network Q&A without session.
      var net = readSelectedNetwork();
      if (state.coachId !== "poppy" && net) {
        reply = zh()
          ? net.name + "：先把站位调整好，再送拍。你刚问的是「" + text.slice(0, 40) + "」——一次只改一个点。"
          : net.name + ': Set the feet, then send the racket. You asked "' + text.slice(0, 40) + '" — one fix at a time.';
      } else {
        reply = c.fail;
      }
    }
    state.history = state.history.concat([{ role: "assistant", content: reply }]);
    state.messages = state.messages.concat([{ role: "coach", text: reply }]);
    state.pending = false;
    render();
  }

  function switchCoach(id) {
    state.coachId = id;
    setActive(id);
    state.history = [];
    state.messages = [];
    var c = tCopy();
    var net = readSelectedNetwork();
    var hello =
      id === "poppy" || id === "zhangqiu"
        ? c.helloZq
        : c.helloNet(net ? net.name : scrubPoppy(""));
    state.messages = [{ role: "coach", text: hello }];
    state.history = [{ role: "assistant", content: hello }];
    render();
  }

  function render() {
    ensureStyle();
    ensureSeedNetwork();
    var host = document.querySelector("[" + MARK + "]");
    if (!host) {
      host = document.createElement("div");
      host.setAttribute(MARK, "1");
      var app = document.getElementById("app") || document.body;
      // Insert near top of coach page content
      if (app.firstChild) app.insertBefore(host, app.firstChild);
      else app.appendChild(host);
    }
    var c = tCopy();
    var net = readSelectedNetwork();
    var onZq = state.coachId === "poppy" || state.coachId === "zhangqiu";
    var html =
      '<div class="zq-nc-wrap" data-network-coach-chat="true">' +
      '<div class="zq-nc-brand">' +
      c.brand +
      "</div>" +
      '<div class="zq-nc-title">' +
      c.title +
      "</div>" +
      '<div class="zq-nc-row" data-coach-chat-personas="true">' +
      '<button type="button" class="zq-nc-chip' +
      (onZq ? " on" : "") +
      '" data-coach-id="poppy" data-coach-kind="zhangqiu" data-coach-selected="' +
      (onZq ? "true" : "false") +
      '"><b data-coach-name="true">' +
      c.zq +
      "</b><span>" +
      (onZq ? c.chatting : c.zqHint) +
      "</span></button>" +
      (net
        ? '<button type="button" class="zq-nc-chip' +
          (!onZq ? " on" : "") +
          '" data-coach-id="' +
          net.id +
          '" data-coach-kind="network" data-coach-selected="' +
          (!onZq ? "true" : "false") +
          '"><b data-coach-name="true">' +
          net.name +
          "</b><span>" +
          (!onZq ? c.chatting : c.netHint) +
          "</span>" +
          (net.style ? "<i>" + net.style + "</i>" : "") +
          "</button>"
        : "") +
      "</div>" +
      '<button type="button" class="zq-nc-link" data-action="open-coach-picker">' +
      (net ? c.change : c.pick) +
      "</button>" +
      (!net ? '<p class="zq-nc-hint">' + c.pickHint + "</p>" : "") +
      '<div class="zq-nc-log" data-coach-panel="network-chat"></div>' +
      '<form class="zq-nc-form" data-coach-composer="true">' +
      '<input type="text" maxlength="500" placeholder="' +
      c.ph +
      '" />' +
      "<button type=\"submit\"" +
      (state.pending ? " disabled" : "") +
      ">" +
      c.send +
      "</button>" +
      "</form></div>";
    host.innerHTML = html;

    var log = host.querySelector(".zq-nc-log");
    state.messages.forEach(function (m) {
      var d = document.createElement("div");
      d.className = "zq-nc-bubble " + (m.role === "user" ? "user" : "coach");
      d.textContent = m.text;
      log.appendChild(d);
    });
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
      var input = form.querySelector("input");
      var val = (input.value || "").trim();
      if (!val || state.pending) return;
      input.value = "";
      sendChat(val);
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
    if (!state.messages.length) switchCoach(state.coachId);
    else render();
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
