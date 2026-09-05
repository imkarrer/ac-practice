/* Living public series canvas. Hash #series-1 / #weekend / #r00 scrolls into view. */
(function () {
  const id = (location.hash || "").replace(/^#/, "");
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ block: "start" });
})();
