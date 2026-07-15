// Public-safe dashboard renderer.
// Reads ONLY ./public-data.json (allowlist-validated before publish).
// All DOM is built with createElement/textContent — no innerHTML anywhere.
"use strict";

const STATUS = {
  running:   { label: "RUNNING",  cls: "run"   },
  queued:    { label: "대기 중",   cls: "queue" },
  completed: { label: "✓",        cls: "done"  },
  failed:    { label: "실패/중단", cls: "fail"  },
};
const NOTE = {
  opt_in_progress: "구조 최적화 진행 중",
  scf_in_progress: "수렴 계산 진행 중",
  needs_review:    "수렴 확인 필요",
  internal_review: "내부 검토 중",
  queued_capacity: "계산 자원 대기 중",
};
const TYPE = {
  molecule: "분자 계산", surface: "표면 계산",
  adsorption: "흡착 계산", post: "후처리",
};
const REL = { gt: " > ", gte: " ≥ ", muchgt: " ≫ ", approx: " ≈ " };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function candLabel(id) {
  return /^CAND-[A-Z]$/.test(id) ? "후보 " + id.slice(5) : "후보 ?";
}
function fmtMin(min) {
  if (min < 60) return min + "분";
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m ? h + "시간 " + m + "분" : h + "시간";
}
function fmtH(h) {
  const r = Math.round(h * 2) / 2;
  return "약 " + (Number.isInteger(r) ? r : r.toFixed(1)) + "시간";
}

function renderActive(list, genMs) {
  const box = document.getElementById("jobs");
  while (box.firstChild) box.removeChild(box.firstChild);
  if (!list.length) box.appendChild(el("div", "detail", "진행 중인 계산이 없습니다."));
  const live = [];
  list.forEach(j => {
    const s = STATUS[j.status] || STATUS.queued;
    const card = el("div", "job" + (j.status === "running" ? " active" : ""));
    const head = el("div", "jhead");
    head.appendChild(el("span", "st " + s.cls, s.label));
    head.appendChild(el("span", "nm", j.alias));
    card.appendChild(head);
    card.appendChild(el("div", "detail", NOTE[j.note] || "진행 중"));
    const track = el("div", "track" + (j.status === "running" ? "" : " indet"));
    const fill = el("div", "fill");
    track.appendChild(fill);
    card.appendChild(track);
    const times = el("div", "times");
    card.appendChild(times);
    box.appendChild(card);
    if (j.status === "running") {
      fill.style.width = j.progress + "%";
      live.push({ j, times });
    } else {
      times.appendChild(el("span", null, "자원 대기 중"));
    }
  });
  function tick() {
    const extra = Math.max(0, (Date.now() - genMs) / 3600000);
    live.forEach(({ j, times }) => {
      while (times.firstChild) times.removeChild(times.firstChild);
      const sp = el("span", null, "경과 ");
      sp.appendChild(el("b", null, fmtH(j.elapsed_hours + extra)));
      times.appendChild(sp);
      times.appendChild(el("span", "pct", "진행률 ~" + j.progress + "%"));
    });
  }
  tick();
  setInterval(tick, 60000);
}

function renderSummary(s) {
  const box = document.getElementById("summary");
  while (box.firstChild) box.removeChild(box.firstChild);
  let rank = "";
  s.ranking.forEach((c, i) => {
    if (i) rank += REL[s.relations[i - 1]] || " · ";
    rank += candLabel(c);
  });
  if (rank) box.appendChild(el("p", "rank", rank + "  (상대 안정성)"));
  s.pending.forEach(c =>
    box.appendChild(el("p", "formula", candLabel(c) + " — 계산 진행 중")));
  box.appendChild(el("p", "formula",
    "정확한 에너지·구조·계산 조건은 " +
    (s.status === "published" ? "논문 참조." : "내부 검토 중이며 공개하지 않습니다.")));
}

function renderHistory(list) {
  const dl = document.getElementById("donelist");
  const more = document.getElementById("more");
  document.getElementById("dcount").textContent = String(list.length);
  while (dl.firstChild) dl.removeChild(dl.firstChild);
  const row = r => {
    const s = STATUS[r.status] || STATUS.failed;
    const d = el("div", "drow");
    d.appendChild(el("span", "st " + s.cls, s.label));
    d.appendChild(el("span", "nm", r.alias));
    d.appendChild(el("span", "dd", TYPE[r.type] || ""));
    d.appendChild(el("span", "dur", fmtMin(r.runtime_minutes)));
    d.appendChild(el("span", "when", r.finished_on.slice(5)));
    return d;
  };
  list.slice(0, 3).forEach(r => dl.appendChild(row(r)));
  const rest = el("div");
  rest.id = "dmore";
  rest.style.display = "none";
  list.slice(3).forEach(r => rest.appendChild(row(r)));
  dl.appendChild(rest);
  let open = false;
  const lbl = () => { more.textContent = open ? "접기 ▴" :
    "더보기 — 이전 작업 " + Math.max(0, list.length - 3) + "개 ▾"; };
  lbl();
  more.onclick = () => { open = !open;
    rest.style.display = open ? "block" : "none"; lbl(); };
}

async function boot() {
  const jobsBox = document.getElementById("jobs");
  if (!jobsBox) return; // gallery page: static
  try {
    const res = await fetch("public-data.json", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const d = await res.json();
    if (d.schema !== "public-dashboard/v1") throw new Error("schema");
    const genMs = Date.parse(d.generated);
    document.getElementById("asof").textContent =
      d.generated.slice(0, 16).replace("T", " ") + " KST";
    renderActive(d.active, genMs);
    renderSummary(d.summary);
    renderHistory(d.history);
  } catch (e) {
    jobsBox.appendChild(el("div", "err",
      "상태 데이터를 불러오지 못했습니다 (오프라인이거나 갱신 중)."));
  }
}
boot();

// left-edge swipe-back (installed PWA convenience)
(function () {
  let sx = -1, sy = 0, st = 0;
  addEventListener("touchstart", e => { const t = e.touches[0];
    sx = t.clientX < 28 ? t.clientX : -1; sy = t.clientY; st = Date.now(); },
    { passive: true });
  addEventListener("touchend", e => { if (sx < 0) return;
    const t = e.changedTouches[0];
    if (t.clientX - sx > 64 && Math.abs(t.clientY - sy) < 60 &&
        Date.now() - st < 700) history.back(); sx = -1; }, { passive: true });
})();

if ("serviceWorker" in navigator) {
  addEventListener("load", () =>
    navigator.serviceWorker.register("sw.js").catch(() => {}));
}
