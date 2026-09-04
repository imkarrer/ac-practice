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

function emptyRow(text) {
  const tr = el("tr");
  const td = el("td", { colspan: "4", class: "muted" }, [text]);
  tr.appendChild(td);
  return tr;
}

function lapTable(rows, emptyText) {
  const table = el("table", { class: "laps" });
  const thead = el("thead");
  const hr = el("tr");
  ["#", "Driver", "Steam ID", "Time"].forEach(function (label) {
    hr.appendChild(el("th", null, [label]));
  });
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = el("tbody");
  if (!rows || !rows.length) {
    tbody.appendChild(emptyRow(emptyText));
  } else {
    rows.forEach(function (row, i) {
      const tr = el("tr");
      tr.appendChild(el("td", { class: "pos" }, [String(i + 1)]));
      tr.appendChild(el("td", null, [row.name || "—"]));
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

function renderJoins(data) {
  const lobbies = (data && data.lobbies) || {};
  document.querySelectorAll("[data-lobby]").forEach(function (btn) {
    const online = onlineDrivers(lobbies[btn.getAttribute("data-lobby")]);
    const names = online.map(function (row) { return row.name; }).filter(Boolean).join(", ");
    const status = btn.querySelector(".join-status");
    if (status) status.textContent = onlineLabel(online);
    if (names) btn.setAttribute("title", names);
    else btn.removeAttribute("title");
    btn.classList.toggle("empty", !online.length);
    btn.classList.toggle("busy", online.length > 0);
  });
}

function renderBoard(data) {
  const root = document.getElementById("boards");
  const stamp = document.getElementById("board-stamp");
  root.textContent = "";
  stamp.textContent = data.updated ? "Updated " + data.updated.replace("T", " ").replace("+00:00", " UTC") : "";
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
    const live = el("span", { class: "live " + (online.length ? "busy" : "empty") }, [onlineLabel(online)]);
    heading.appendChild(live);
    wrap.appendChild(heading);
    wrap.appendChild(renderCarBoards(lobby.allTime, lobby.session));
    root.appendChild(wrap);
  });
}

async function loadBoard() {
  try {
    const res = await fetch("leaderboard.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("missing");
    renderBoard(await res.json());
  } catch (err) {
    document.getElementById("boards").textContent = "";
    document.getElementById("boards").appendChild(
      el("p", { class: "muted" }, ["No laps recorded yet."])
    );
  }
}

loadBoard();
setInterval(loadBoard, 15000);
