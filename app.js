/* CONFIG */
const LIVE_URL = "https://meteomg-tunel.franquinho.info/live";
const HIST_URL = "https://meteomg-tunel.franquinho.info/history?hours=24";

/* IPMA – mete aqui o teu local (globalIdLocal)  */
const IPMA_GLOBAL_ID = 1100900; 
const IPMA_FORECAST = `https://api.ipma.pt/open-data/forecast/meteorology/cities/daily/${IPMA_GLOBAL_ID}.json`;

/* Helpers */
const $ = sel => document.querySelector(sel);
const fmt = (n, d=0) => (n == null || isNaN(n)) ? "—" : Number(n).toFixed(d);
const degToDir = (deg) => {
  if (deg == null) return "—";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSO","SO","OSO","O","ONO","NO","NNO"];
  return dirs[Math.round(((deg%360)+360)%360 / 22.5) % 16];
};
const localTime = (iso) => new Date(iso);

/* Cabeçalho: data atual */
(function setNow(){
  const now = new Date();
  const fmtDate = now.toLocaleDateString('pt-PT',{weekday:'long', day:'numeric', month:'long'});
  $("#nowDate").textContent = fmtDate.charAt(0).toUpperCase()+fmtDate.slice(1);
})();

/* Sun times (coordenadas aproximadas – ajusta para tua estação) */
const LAT = 39.75, LON = -8.94; 
function setSunTimes(date=new Date()){
  const t = SunCalc.getTimes(date, LAT, LON);
  const opt = {hour:'2-digit', minute:'2-digit'};
  $("#sunrise").textContent = t.sunrise.toLocaleTimeString('pt-PT',opt);
  $("#sunset").textContent  = t.sunset.toLocaleTimeString('pt-PT',opt);
}

/* Previsão IPMA (3 dias) */
async function loadForecast(){
  try{
    const r = await fetch(IPMA_FORECAST, {cache:"no-store"});
    const j = await r.json();
    const days = j.data?.slice(0,3) || [];
    const ul = $("#forecast");
    ul.innerHTML = "";
    days.forEach(d=>{
      const li = document.createElement("li");
      const day = new Date(d.forecastDate);
      const label = day.toLocaleDateString('pt-PT',{weekday:'short'});
      li.innerHTML = `
        <div class="d">${label}</div>
        <div class="ic">⛅</div>
        <div class="t">${Math.round(d.tMax)}° | ${Math.round(d.tMin)}°</div>
      `;
      ul.appendChild(li);
    });
  }catch(e){
    console.warn("IPMA falhou:", e);
  }
}

/* Live */
async function loadLive(){
  const r = await fetch(LIVE_URL, {cache:"no-store", mode:"cors", credentials:"omit"});
  if(!r.ok) throw new Error("live "+r.status);
  const j = await r.json();

  $("#temp").textContent = fmt(j.temp_c, 0);
  $("#apparent").textContent = fmt(j.apparent_c ?? j.temp_c, 0);
  $("#wind").textContent = fmt(j.wind_kmh, 0);
  $("#winddir").textContent = degToDir(j.wind_dir_deg);
  $("#gust").textContent = fmt(j.gust_kmh, 0);
  $("#rh").textContent = fmt(j.rh_pct, 0) + "%";
  $("#dew").textContent = fmt(j.dewpoint_c, 1) + "°";
  $("#press").textContent = fmt(j.pressure_hpa, 0);
  $("#uv").textContent = fmt(j.uv_index, 1);

  const ts = localTime(j.ts_local ?? j.ts_utc);
  setSunTimes(ts);

  $("#age").textContent = j.age_s != null ? `${Math.round(j.age_s)} s` : "—";
  const flag = $("#staleFlag");
  if (j.stale) { flag.textContent = "Dados desatualizados"; flag.className="stale"; }
  else { flag.textContent = "Ligação excelente"; flag.className="ok"; }
}

/* Histórico 24h -> gráfico */
let chart;
async function loadHistory(){
  const r = await fetch(HIST_URL, { cache: "no-store" });
  if (!r.ok) throw new Error("hist " + r.status);
  const rows = await r.json();

  // helpers seguros
  const num  = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const znum = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const clamp = (v,min,max) => Math.max(min, Math.min(max, v));

  // arrays
  const labels     = rows.map(x => new Date(x.ts_utc));
  const tempsRaw   = rows.map(x => num(x.temp_c));              // pode ter null
  const tempsFixed = tempsRaw.map(v => (v == null ? null : clamp(v, 0, 43)));
  const rainRate   = rows.map(x => znum(x.rain_rate_mmph));     // null/NaN -> 0

  // chuva aproximada 24h (amostragem ~10min => 1/6h por ponto)
  const rain24 = rainRate.reduce((a,b)=> a + b/6, 0);
  $("#rain24").textContent = fmt(rain24, 1);

  // gráfico
  const ctx = $("#histChart");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.map(t =>
        t.toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' })
      ),
      datasets: [
        {
          type:'line',
          label:'Temperatura (°C)',
          data: tempsFixed,        // <- null cria “gap” (não liga pontos inválidos)
          yAxisID:'y1',
          borderColor:'#000',
          backgroundColor:'rgba(0,0,0,0)',
          tension:.25,
          borderWidth:2,
          pointRadius:0,
          spanGaps:false           // não ligar por cima de null; mete true se preferires
        },
        {
          type:'bar',
          label:'Precipitação (mm/h)',
          data: rainRate,
          yAxisID:'y2',
          backgroundColor:'#999',
          borderColor:'#000',
          borderWidth:1,
          maxBarThickness:18
        }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,  // parent precisa de altura definida (ver CSS abaixo)
      normalized:true,            // ignora outliers/NaN em cálculos internos
      animation:false,
      plugins:{ legend:{display:false}, tooltip:{enabled:true} },
      scales:{
        x:{ grid:{ color:'#0002' } },
        y1:{
          position:'left',
          grid:{ color:'#0002' },
          min:0, max:43,           // limites fixos
          ticks:{ stepSize:5 }
        },
        y2:{
          position:'right',
          grid:{ display:false },
          beginAtZero:true,
          suggestedMax:10
        }
      }
    }
  });
}


/* Boot */
async function boot(){
  await Promise.all([loadLive(), loadForecast(), loadHistory()]);
  // refrescar live a cada 60s (gráfico pode ficar estático)
  setInterval(loadLive, 60000);
}
boot().catch(console.error);
