const APP_VERSION = "busan-agent-3";
const STORAGE_KEY = "busan-trip-day-flows";
let trip;
let orchestration;
let map;
let mapMarkers = [];
let mapRouteLines = [];
let selectedMapDay = "all";
const MAP_DAY_COLORS = { "16일": "#ee705d", "17일": "#167a91", "18일": "#e1a43b", "19일": "#6a63a8" };

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function loadTrip() {
  const response = await fetch(`./assets/data/busan-family-trip-2026.json?v=${APP_VERSION}`);
  if (!response.ok) throw new Error(`여행 데이터를 불러오지 못했습니다: ${response.status}`);
  return response.json();
}

function contextFromTrip() {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { saved = []; }
  const savedByDate = Object.fromEntries(saved.map((item) => [item.date, item.intent]));
  return { ...trip, dayFlows: trip.dayFlows.map((day) => ({ ...day, intent: savedByDate[day.date] || day.intent })) };
}

function renderHero() {
  document.getElementById("hero-kicker").textContent = trip.hero.kicker;
  document.getElementById("hero-title").textContent = trip.hero.title;
  document.getElementById("hero-summary").textContent = trip.hero.summary;
  document.getElementById("hero-meta").innerHTML = trip.hero.meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  document.getElementById("hero-stats").innerHTML = trip.hero.stats.map((item) => `<div class="stat"><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`).join("");
  document.getElementById("trip-lens").innerHTML = trip.tripLens.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  document.getElementById("fixed-facts").innerHTML = `<div class="fact"><span>가는 KTX</span><strong>서울 07:58 → 부산 10:46</strong></div><div class="fact"><span>오는 KTX</span><strong>부산 14:31 → 서울 17:14</strong></div><div class="fact"><span>숙소 1</span><strong>아스티호텔 16~17일</strong></div><div class="fact"><span>숙소 2</span><strong>파라다이스 17~19일</strong></div>`;
  document.getElementById("agent-strip").innerHTML = trip.team.map((item) => `<article class="agent-card"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.role)}</span></article>`).join("");
}

function renderFlowEditor() {
  const context = contextFromTrip();
  document.getElementById("day-flow-editor").innerHTML = context.dayFlows.map((day) => `<div class="flow-row"><label for="flow-${day.date}">${escapeHtml(day.label)}</label><input id="flow-${day.date}" data-flow-date="${day.date}" value="${escapeHtml(day.intent)}" /></div>`).join("");
}

function saveFlowEditor() {
  const values = [...document.querySelectorAll("[data-flow-date]")].map((input) => ({ date: input.dataset.flowDate, intent: input.value.trim() || "여유롭게 이동" }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
}

function renderItinerary() {
  document.getElementById("itinerary-list").innerHTML = orchestration.days.map((day) => `<article class="day-card"><div class="day-header"><div><span>${escapeHtml(day.date)}</span><h3>${escapeHtml(day.intent)}</h3></div><span>${escapeHtml(day.route.hub)}</span></div>${day.blocks.map((block) => `<div class="block"><time>${escapeHtml(block.time)}</time><div><strong>${escapeHtml(block.title)}</strong><small>${block.type === "water" ? "물놀이·휴식" : block.type === "fixed" ? "고정 교통" : "권장 블록"}</small></div></div>`).join("")}<div class="pill">식사: ${escapeHtml(day.meals.meals.join(" · "))}</div><div class="pill">추천: ${escapeHtml(day.activities.chosen.map((item) => item.title).join(" · "))}</div></article>`).join("");
  document.getElementById("decisions").innerHTML = orchestration.decisions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  document.getElementById("warnings").innerHTML = orchestration.warnings.length ? orchestration.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>현재 입력에서 큰 충돌이 없습니다.</li>";
}

function renderOps() {
  const cards = [...trip.lodgings.map((item) => ({ title: item.name, body: `${item.dates} · ${item.role}` })), { title: "가는 날", body: "부산역 도착 후 아스티호텔에 짐을 맡기고 원도심·영도로 이동" }, { title: "돌아오는 날", body: "씨메르 이용 후 체크아웃·짐 수령·부산역 14:00 도착 목표" }];
  document.getElementById("ops-list").innerHTML = cards.map((item) => `<article class="ops-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p></article>`).join("");
}

function renderRoutes() {
  const rows = orchestration.days.filter((day) => selectedMapDay === "all" || day.date.endsWith(selectedMapDay.replace("일", ""))).map((day) => `<div class="route-row"><strong>${escapeHtml(day.date.slice(5))}</strong>${escapeHtml(day.route.sequence.join(" → "))}</div>`);
  document.getElementById("route-summary").innerHTML = rows.join("");
}

function renderFood() {
  document.getElementById("food-list").innerHTML = orchestration.days.flatMap((day) => day.meals.meals.map((meal) => `<article class="food-card"><span class="tag">${escapeHtml(day.date.slice(5))} · ${escapeHtml(day.route.hub)}</span><h3>${escapeHtml(meal)}</h3><p>동선과 영상 출처를 참고한 후보. 영업·대기·예약은 출발 전 확인.</p></article>`)).join("");
}

function renderBudget() {
  document.getElementById("budget-list").innerHTML = Object.values(trip.budgets).map((item) => `<article class="card budget-card"><h3>${escapeHtml(item.name)}</h3><strong>${escapeHtml(item.total)}</strong><p>${escapeHtml(item.note)}</p></article>`).join("");
}

function renderSources() {
  const videos = trip.videoSources.map((source) => `<article class="source-card"><div><span class="format">${source.format === "shorts" ? "SHORTS" : "LONGFORM"} · ${escapeHtml(source.role)}</span><p>${escapeHtml(source.title)}</p></div><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">영상 열기 ↗</a></article>`);
  const official = trip.recheckSources.map((source) => `<article class="source-card"><div><span class="format">OFFICIAL RECHECK</span><p>${escapeHtml(source.title)} · ${escapeHtml(source.note)}</p></div><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">공식 확인 ↗</a></article>`);
  document.getElementById("source-list").innerHTML = [...videos, ...official].join("");
  document.getElementById("recheck-note").textContent = trip.recheckNote;
}

function mapPinIcon(point, index, highlighted) {
  const dayColor = MAP_DAY_COLORS[point.day] || "#167a91";
  return L.divIcon({ className: "map-pin-wrap", html: `<span class="map-pin ${highlighted ? "highlighted" : "muted"}" style="--pin-color:${dayColor}"><b>${index + 1}</b></span>`, iconSize: [30, 38], iconAnchor: [15, 38], popupAnchor: [0, -36] });
}

function mapDays() {
  return ["all", ...Object.keys(trip.mapRoutePoints || {})];
}

function renderMapDayFilter() {
  document.getElementById("map-day-filter").innerHTML = mapDays().map((day) => `<button type="button" class="${selectedMapDay === day ? "active" : ""}" data-map-day="${day}">${day === "all" ? "전체 동선" : day}</button>`).join("");
  document.querySelectorAll("[data-map-day]").forEach((button) => button.addEventListener("click", () => { selectedMapDay = button.dataset.mapDay; renderMapDayFilter(); refreshMap(); renderRoutes(); }));
}

function refreshMap() {
  if (!window.L || !map) return;
  mapMarkers.forEach((marker) => marker.remove());
  mapRouteLines.forEach((line) => line.remove());
  mapMarkers = [];
  mapRouteLines = [];
  const routes = trip.mapRoutePoints || {};
  Object.entries(routes).forEach(([day, points]) => {
    const isSelected = selectedMapDay === "all" || selectedMapDay === day;
    const line = L.polyline(points.map((point) => [point.lat, point.lng]), { color: MAP_DAY_COLORS[day] || "#167a91", weight: isSelected ? 5 : 2, opacity: isSelected ? 0.85 : 0.2, dashArray: isSelected ? undefined : "5 8" }).addTo(map);
    mapRouteLines.push(line);
    points.forEach((point, index) => {
      const marker = L.marker([point.lat, point.lng], { icon: mapPinIcon({ ...point, day }, index, isSelected), zIndexOffset: isSelected ? 500 : 0 }).addTo(map).bindPopup(`<strong>${escapeHtml(point.name)}</strong><br>${escapeHtml(day)} · ${index + 1}번째`);
      mapMarkers.push(marker);
    });
  });
}

function renderMap() {
  if (!window.L) return;
  if (!map) { map = L.map("map").setView([35.13, 129.09], 11); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map); }
  renderMapDayFilter();
  refreshMap();
}

function renderAll() { renderHero(); renderFlowEditor(); orchestration = window.runTripOrchestrator(contextFromTrip()); renderItinerary(); renderOps(); renderRoutes(); renderFood(); renderBudget(); renderSources(); renderMap(); }

function initTabs() {
  document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("[data-tab], [data-panel]").forEach((element) => element.classList.remove("active")); button.classList.add("active"); document.querySelector(`[data-panel="${button.dataset.tab}"]`).classList.add("active"); if (button.dataset.tab === "explore" && map) setTimeout(() => map.invalidateSize(), 0); }));
}

/** Start the Busan trip control room. */
async function main() {
  try { trip = await loadTrip(); initTabs(); renderAll(); document.getElementById("recalculate").addEventListener("click", () => { saveFlowEditor(); renderAll(); document.querySelector('[data-tab="itinerary"]').click(); }); } catch (error) { document.body.innerHTML = `<main class="card"><h1>여행 데이터를 불러오지 못했습니다.</h1><p>${escapeHtml(error.message)}</p></main>`; }
}

main();
