function formatTime(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return m + ":" + String(s).padStart(2, "0") + "." + String(milli).padStart(3, "0");
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(function (entry) {
      if (entry[1] != null) node.setAttribute(entry[0], entry[1]);
    });
  }
  (children || []).forEach(function (child) {
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  });
  return node;
}

const RANK_KEY = "ac-rank-mode";
const RANK_HINTS = {
  all: "Every car on one list — fastest lap wins.",
  car: "Positions restart for each car, so a Civic isn't racing a 124.",
};
// Plugin pings ntfy every 60s and does not rewrite GitHub on each beat.
// Fail-over has to be several missed beats, and first paint must wait for
// ntfy before treating a stale leaderboard.json timestamp as "down".
const HEALTH_BEAT_MS = 60 * 1000;
const HEALTH_STALE_MS = 4 * 60 * 1000;
const HEALTH_GRACE_MS = 90 * 1000;

let lastBoard = null;
let lastAliveAt = 0;
let healthWatchStarted = Date.now();

function rankMode() {
  try {
    return localStorage.getItem(RANK_KEY) === "all" ? "all" : "car";
  } catch (err) {
    return "car";
  }
}

function setRankMode(mode) {
  const next = mode === "all" ? "all" : "car";
  try {
    localStorage.setItem(RANK_KEY, next);
  } catch (err) {}
  syncRankToggle();
  if (lastBoard) renderBoard(lastBoard);
}

function syncRankToggle() {
  const mode = rankMode();
  document.querySelectorAll("[data-rank]").forEach(function (btn) {
    const on = btn.getAttribute("data-rank") === mode;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const hint = document.getElementById("board-hint");
  if (hint) hint.textContent = RANK_HINTS[mode];
}

function emptyRow(text, cols) {
  const tr = el("tr");
  const td = el("td", { colspan: String(cols || 4), class: "muted" }, [text]);
  tr.appendChild(td);
  return tr;
}

function lapTable(rows, emptyText, opts) {
  const showCar = !!(opts && opts.showCar);
  const labels = showCar ? ["#", "Driver", "Car", "Steam ID", "Time"] : ["#", "Driver", "Steam ID", "Time"];
  const table = el("table", { class: "laps" });
  const thead = el("thead");
  const hr = el("tr");
  labels.forEach(function (label) {
    hr.appendChild(el("th", null, [label]));
  });
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = el("tbody");
  if (!rows || !rows.length) {
    tbody.appendChild(emptyRow(emptyText, labels.length));
  } else {
    rows.forEach(function (row, i) {
      const tr = el("tr");
      tr.appendChild(el("td", { class: "pos" }, [String(i + 1)]));
      tr.appendChild(el("td", null, [row.name || "—"]));
      if (showCar) tr.appendChild(el("td", null, [row.carName || row.car || "—"]));
      const guid = row.guid || "";
      const steam = guid
        ? el("a", { class: "steam", href: "https://steamcommunity.com/profiles/" + guid, target: "_blank", rel: "noopener" }, [guid])
        : document.createTextNode("—");
      const guidCell = el("td", { class: "guid" });
      guidCell.appendChild(steam);
      tr.appendChild(guidCell);
      tr.appendChild(el("td", { class: "time" }, [formatTime(row.ms)]));
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);
  return table;
}

function carKey(row) {
  return row.car || row.carName || "unknown";
}

function carLabel(row) {
  return row.carName || row.car || "Unknown car";
}

function groupByCar(allTime, session) {
  const groups = {};
  function take(rows, bucket) {
    (rows || []).forEach(function (row) {
      const key = carKey(row);
      if (!groups[key]) {
        groups[key] = { key: key, name: carLabel(row), allTime: [], session: [] };
      }
      if (row.carName) groups[key].name = row.carName;
      groups[key][bucket].push(row);
    });
  }
  take(allTime, "allTime");
  take(session, "session");
  return Object.keys(groups)
    .map(function (key) { return groups[key]; })
    .sort(function (a, b) {
      const aBest = (a.allTime[0] || a.session[0] || {}).ms;
      const bBest = (b.allTime[0] || b.session[0] || {}).ms;
      const aMs = aBest == null ? Infinity : Number(aBest);
      const bMs = bBest == null ? Infinity : Number(bBest);
      if (aMs !== bMs) return aMs - bMs;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
}

function carMeta(group) {
  const pace = group.allTime[0] || group.session[0];
  const seen = {};
  let drivers = 0;
  group.allTime.concat(group.session).forEach(function (row) {
    const guid = row.guid || row.name;
    if (!guid || seen[guid]) return;
    seen[guid] = true;
    drivers += 1;
  });
  const bits = [];
  if (pace) bits.push("Best " + formatTime(pace.ms));
  if (drivers) bits.push(drivers === 1 ? "1 driver" : drivers + " drivers");
  return bits.join(" · ");
}

function renderMixedBoards(allTime, session) {
  const wrap = el("div", { class: "mixed-boards" });
  wrap.appendChild(el("h4", null, ["All-time"]));
  wrap.appendChild(lapTable(allTime, "No valid laps yet.", { showCar: true }));
  wrap.appendChild(el("h4", null, ["This session"]));
  wrap.appendChild(lapTable(session, "No valid laps this session.", { showCar: true }));
  return wrap;
}

function renderLobbyTimes(lobby) {
  if (rankMode() === "all") return renderMixedBoards(lobby.allTime, lobby.session);
  return renderCarBoards(lobby.allTime, lobby.session);
}

function renderCarBoards(allTime, session) {
  const wrap = el("div", { class: "car-boards" });
  const groups = groupByCar(allTime, session);
  if (!groups.length) {
    wrap.appendChild(el("p", { class: "muted" }, ["No valid laps yet."]));
    return wrap;
  }
  groups.forEach(function (group) {
    const block = el("div", { class: "car-group" });
    block.appendChild(el("h3", { class: "car-name" }, [group.name]));
    const meta = carMeta(group);
    if (meta) block.appendChild(el("p", { class: "car-meta" }, [meta]));
    if (group.allTime.length) {
      block.appendChild(el("h4", null, ["All-time"]));
      block.appendChild(lapTable(group.allTime, "No valid laps yet."));
    }
    if (group.session.length) {
      block.appendChild(el("h4", null, ["This session"]));
      block.appendChild(lapTable(group.session, "No valid laps this session."));
    }
    wrap.appendChild(block);
  });
  return wrap;
}

function practiceIds(lobbies) {
  return Object.keys(lobbies).filter(function (id) {
    if (id.indexOf("race-") === 0 || id.indexOf("slot-") === 0) return false;
    return true;
  });
}

function onlineDrivers(lobby) {
  return (lobby && lobby.online) || [];
}

function onlineLabel(online) {
  if (!online.length) return "empty";
  if (online.length === 1) return online[0].name || "1 online";
  return online.length + " online";
}

function parseStamp(value) {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function markAlive(when) {
  const ms = when ? parseStamp(when) : Date.now();
  if (!ms || Date.now() - ms >= HEALTH_STALE_MS) return;
  if (ms > lastAliveAt) lastAliveAt = ms;
}

function newestStamp(data) {
  return Math.max(
    lastAliveAt,
    parseStamp(data && data.aliveAt),
    parseStamp(data && data.updated)
  );
}

function boardHealth(data) {
  const status = String((data && data.status) || "").toLowerCase();
  const custom = ((data && data.statusMessage) || "").trim();
  if (status === "maintenance" || status === "down") {
    return {
      state: "down",
      label: status === "maintenance" ? "Maintenance" : "Down",
      title: status === "maintenance" ? "Down for maintenance" : "Servers down",
      message: custom || "Practice servers are down for maintenance.",
    };
  }
  const fresh = newestStamp(data);
  if (fresh && Date.now() - fresh < HEALTH_STALE_MS) {
    return { state: "up", label: "Online", title: "", message: "" };
  }
  if (Date.now() - healthWatchStarted < HEALTH_GRACE_MS) {
    return { state: "checking", label: "Checking…", title: "", message: "" };
  }
  return {
    state: "down",
    label: "Down",
    title: "Servers down",
    message: custom || "Practice servers are offline.",
  };
}

function renderHealth(data) {
  const health = boardHealth(data || lastBoard || {});
  const root = document.getElementById("health");
  if (root) {
    root.setAttribute("data-state", health.state);
    const label = root.querySelector(".health-label");
    if (label) label.textContent = health.label;
  }
  const banner = document.getElementById("health-banner");
  if (banner) {
    const down = health.state === "down";
    banner.hidden = !down;
    const title = document.getElementById("health-title");
    const message = document.getElementById("health-message");
    if (title) title.textContent = health.title || "Servers down";
    if (message) message.textContent = health.message || "Practice servers are offline.";
  }
  document.body.classList.toggle("servers-down", health.state === "down");
  return health;
}

function renderJoins(data) {
  const lobbies = (data && data.lobbies) || {};
  const down = boardHealth(data).state === "down";
  document.querySelectorAll("[data-lobby]").forEach(function (btn) {
    const online = onlineDrivers(lobbies[btn.getAttribute("data-lobby")]);
    const names = online.map(function (row) { return row.name; }).filter(Boolean).join(", ");
    const status = btn.querySelector(".join-status");
    if (status) status.textContent = down ? "down" : onlineLabel(online);
    if (down) btn.setAttribute("title", "Servers are down");
    else if (names) btn.setAttribute("title", names);
    else btn.removeAttribute("title");
    btn.classList.toggle("empty", !down && !online.length);
    btn.classList.toggle("busy", !down && online.length > 0);
    btn.classList.toggle("down", down);
  });
}

function renderBoard(data) {
  lastBoard = data;
  markAlive(data && (data.aliveAt || data.updated));
  const down = renderHealth(data).state === "down";
  const root = document.getElementById("boards");
  const stamp = document.getElementById("board-stamp");
  root.textContent = "";
  if (stamp) stamp.textContent = data.updated ? "Updated " + data.updated.replace("T", " ").replace("+00:00", " UTC") : "";
  syncRankToggle();
  renderJoins(data);
  const lobbies = data.lobbies || {};
  const ids = practiceIds(lobbies);
  if (!ids.length) {
    root.appendChild(el("p", { class: "muted" }, ["No laps recorded yet."]));
    return;
  }
  ids.forEach(function (id) {
    const lobby = lobbies[id];
    const wrap = el("div", { class: "board" });
    const heading = el("h2", null, [lobby.name || id]);
    const online = onlineDrivers(lobby);
    const liveClass = down ? "live down" : "live " + (online.length ? "busy" : "empty");
    const live = el("span", { class: liveClass }, [down ? "down" : onlineLabel(online)]);
    heading.appendChild(live);
    wrap.appendChild(heading);
    wrap.appendChild(renderLobbyTimes(lobby));
    root.appendChild(wrap);
  });
}

let lastUpdated = null;
let loadInflight = false;

function eventsUrl() {
  const fromDom = (document.documentElement.getAttribute("data-events") || "").trim();
  if (fromDom && fromDom.indexOf("__AC_") === -1) return fromDom;
  return "https://ntfy.sh/ac-imkarrer-ac-practice-status/sse";
}

function eventsPollUrl() {
  const sse = eventsUrl();
  if (!sse) return "";
  return sse.replace(/\/sse\/?$/, "") + "/json?poll=1&since=10m";
}

async function loadBoard() {
  if (loadInflight) return;
  loadInflight = true;
  try {
    const res = await fetch("leaderboard.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("missing");
    const data = await res.json();
    markAlive(data && (data.aliveAt || data.updated));
    renderHealth(data);
    if (lastUpdated && data.updated === lastUpdated) {
      renderJoins(data);
      return;
    }
    lastUpdated = data.updated || null;
    renderBoard(data);
  } catch (err) {
    if (lastBoard) return;
    document.getElementById("boards").textContent = "";
    document.getElementById("boards").appendChild(
      el("p", { class: "muted" }, ["No laps recorded yet."])
    );
  } finally {
    loadInflight = false;
  }
}

function loadBoardSoon() {
  loadBoard();
  [1500, 4000, 8000].forEach(function (ms) {
    setTimeout(loadBoard, ms);
  });
}

function noteEvent(raw) {
  const text = String(raw || "").trim();
  markAlive();
  renderHealth(lastBoard || {});
  if (text && text !== "heartbeat") {
    lastUpdated = null;
    loadBoardSoon();
  }
}

async function pollRecentEvents() {
  const url = eventsPollUrl();
  if (!url) return;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const body = await res.text();
    let latest = 0;
    body.split("\n").forEach(function (line) {
      if (!line.trim()) return;
      try {
        const row = JSON.parse(line);
        const when = Number(row.time) * 1000;
        if (Number.isFinite(when) && when > latest) latest = when;
      } catch (err) {}
    });
    if (latest) {
      markAlive(new Date(latest).toISOString());
      renderHealth(lastBoard || {});
    }
  } catch (err) {}
}

function watchStatusEvents() {
  const url = eventsUrl();
  if (!url || typeof EventSource === "undefined") return;
  try {
    const source = new EventSource(url);
    source.addEventListener("message", function (event) {
      noteEvent(event && event.data);
    });
  } catch (err) {}
}

document.querySelectorAll("[data-rank]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    setRankMode(btn.getAttribute("data-rank"));
  });
});
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) loadBoard();
});
syncRankToggle();
renderHealth({});
loadBoard();
pollRecentEvents();
watchStatusEvents();
setInterval(loadBoard, 15000);
setInterval(function () { renderHealth(lastBoard || {}); }, 15000);
setTimeout(function () { renderHealth(lastBoard || {}); }, HEALTH_GRACE_MS);
