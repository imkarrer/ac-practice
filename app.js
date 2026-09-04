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
  const td = el("td", { colspan: "5", class: "muted" }, [text]);
  tr.appendChild(td);
  return tr;
}

function lapTable(rows, emptyText) {
  const table = el("table", { class: "laps" });
  const thead = el("thead");
  const hr = el("tr");
  ["#", "Driver", "Steam ID", "Car", "Time"].forEach(function (label) {
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
      tr.appendChild(el("td", null, [row.carName || row.car || "—"]));
      tr.appendChild(el("td", { class: "time" }, [formatTime(row.ms)]));
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);
  return table;
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
    wrap.appendChild(el("h3", null, ["All-time"]));
    wrap.appendChild(lapTable(lobby.allTime, "No valid laps yet."));
    wrap.appendChild(el("h3", null, ["This session"]));
    wrap.appendChild(lapTable(lobby.session, "No valid laps this session."));
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
