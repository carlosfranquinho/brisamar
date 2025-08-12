// Endpoint live (usar HTTPS para evitar mixed content)
const LIVE_URL = "https://meteomg-tunel.franquinho.info/live";

// refresco automático (segundos)
const REFRESH_SEC = 60;

const el = id => document.getElementById(id);

function fmt(n, d=1){
  if (n === null || n === undefined || isNaN(n)) return "--";
  return Number(n).toFixed(d).replace(".", ",");
}
function timeAgo(tsIso){
  try{
    const ts = new Date(tsIso);
    const now = new Date();
    const sec = Math.max(0, Math.round((now - ts)/1000));
    if (sec < 60) return `${sec}s atrás`;
    const m = Math.round(sec/60);
    if (m < 60) return `${m} min atrás`;
    const h = Math.round(m/60);
    return `${h} h atrás`;
  }catch{ return "—"; }
}
function setWindArrow(deg){
  if (deg == null || isNaN(deg)) return;
  // seta aponta PARA norte; rodamos para “vir de” (meteo: direção de origem)
  el("windArrow").style.transform = `translateX(-50%) rotate(${deg}deg)`;
}

async function fetchLive(){
  const res = await fetch(LIVE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function update(){
  try{
    const live = await fetchLive();

    // valores
    el("temp_c").textContent        = fmt(live.temp_c, 1);
    el("apparent_c").textContent    = fmt(live.apparent_c, 1);
    el("rh_pct").textContent        = fmt(live.rh_pct, 0);
    el("dewpoint_c").textContent    = fmt(live.dewpoint_c, 1);
    el("wind_kmh").textContent      = fmt(live.wind_kmh, 1);
    el("gust_kmh").textContent      = fmt(live.gust_kmh, 1);
    el("pressure_hpa").textContent  = fmt(live.pressure_hpa, 1);
    el("rain_day_mm").textContent   = fmt(live.rain_day_mm, 2);
    el("rain_rate_mmph").textContent= fmt(live.rain_rate_mmph, 2);
    el("solar_wm2").textContent     = fmt(live.solar_wm2, 0);
    el("uv_index").textContent      = fmt(live.uv_index, 1);

    // direção do vento
    el("wind_dir_deg").textContent = live.wind_dir_deg != null ? live.wind_dir_deg : "--";
    setWindArrow(Number(live.wind_dir_deg));

    // timestamps / stale
    el("ts_local").textContent = live.ts_local
      ? new Date(live.ts_local).toLocaleString("pt-PT")
      : "—";

    const age = typeof live.age_s === "number" ? live.age_s : null;
    el("ageText").textContent = age != null ? `atualizado há ${Math.round(age)}s` : "—";

    const stale = !!live.stale;
    el("staleBadge").classList.toggle("hidden", !stale);
    document.title = stale ? "⚠️ Brisamar — sem dados recentes" : "Brisamar — tempo em tempo real";
  }catch(err){
    console.error("Falha a obter /live:", err);
    el("staleBadge").classList.remove("hidden");
    el("staleBadge").textContent = "falha ao obter dados";
    el("ageText").textContent = "—";
  }
}

function tick(){
  update().finally(() => {
    setTimeout(tick, REFRESH_SEC * 1000);
  });
}

// boot
el("year").textContent = new Date().getFullYear();
tick();
