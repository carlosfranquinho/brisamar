/* CONFIG */
const LIVE_URL = "https://meteomg-tunel.franquinho.info/live";
const HIST_URL = "https://meteomg-tunel.franquinho.info/history?hours=24";

/* IPMA – mete aqui o teu local (globalIdLocal)  */
const IPMA_GLOBAL_ID = 1100900;
const IPMA_FORECAST = `https://api.ipma.pt/open-data/forecast/meteorology/cities/daily/${IPMA_GLOBAL_ID}.json`;

/* Helpers */
const $ = (sel) => document.querySelector(sel);
const fmt = (n, d = 0) => (n == null || isNaN(n) ? "—" : Number(n).toFixed(d));
const degToDir = (deg) => {
  if (deg == null) return "—";
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSO",
    "SO",
    "OSO",
    "O",
    "ONO",
    "NO",
    "NNO",
  ];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
};
const localTime = (iso) => new Date(iso);

function setText(sel, text) {
  const el = $(sel);
  if (!el) return;
  const prev = el.dataset.val ?? el.textContent;
  el.textContent = text;
  el.dataset.val = text;
  if (String(prev) !== String(text)) {
    el.classList.add("pulse");
    setTimeout(() => el.classList.remove("pulse"), 350);
  }
}

let countdownTimer = null,
  nextRefreshAt = 0;
function startCountdown(ms) {
  nextRefreshAt = Date.now() + ms;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    const s = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
    const txt = s === 0 ? "agora" : `em ${s}s`;
    const el = $("#age");
    if (el) el.textContent = txt; // sem “pulse” a cada tick
    if (s === 0) clearInterval(countdownTimer);
  }, 250);
}

/* Cabeçalho: data atual */
(function setNow() {
  const now = new Date();
  const fmtDate = now.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  $("#nowDate").textContent =
    fmtDate.charAt(0).toUpperCase() + fmtDate.slice(1);
})();

// Dia/noite: usa horários já formatados "HH:MM"
function isDay(nowTs, sunriseStr, sunsetStr) {
  const [srH, srM] = sunriseStr.split(":").map(Number);
  const [ssH, ssM] = sunsetStr.split(":").map(Number);
  const now = new Date(nowTs);
  const sr = new Date(now);
  sr.setHours(srH, srM, 0, 0);
  const ss = new Date(now);
  ss.setHours(ssH, ssM, 0, 0);
  return now >= sr && now < ss;
}

// Mapa ultra-prático IPMA → nome do ícone do sprite
function iconNameFromIpma(code, isDaytime) {
  const c = Number(code);
  if (c === 1) return isDaytime ? "clear-day" : "clear-night";
  if (c === 2 || c === 3 || c === 25)
    return isDaytime ? "partly-cloudy-day" : "partly-cloudy-night";
  if (c === 4 || c === 24 || c === 27) return "cloudy";
  if (c === 5) return "overcast";

  if ([6, 7, 8, 15].includes(c)) return "rain";
  if ([9, 10, 12, 13].includes(c)) return "drizzle";
  if ([11, 14].includes(c)) return "heavy-rain";

  if ([16, 17, 26].includes(c)) return "fog";

  if (c === 18) return "snow";
  if (c === 21) return "sleet";
  if (c === 22) return "freezing-rain";
  if ([19, 20, 23].includes(c)) return "thunder";

  return "unknown";
}

// Aplica no ícone grande do topo
function renderNowIcon(ipmaCode, sunriseHHMM, sunsetHHMM) {
  const day = isDay(Date.now(), sunriseHHMM, sunsetHHMM);
  const name = iconNameFromIpma(ipmaCode, day);
  const use = document.querySelector("#bm-now-ico use");
  if (use) use.setAttribute("href", `#bm-icon-${name}`);

  const svg = document.getElementById("bm-now-ico");
  if (!svg) return;
  svg.classList.remove("sunny", "alert", "neutral");
  if (
    [
      "clear-day",
      "clear-night",
      "partly-cloudy-day",
      "partly-cloudy-night",
    ].includes(name)
  )
    svg.classList.add("sunny");
  else if (["thunder", "heavy-rain"].includes(name)) svg.classList.add("alert");
  else svg.classList.add("neutral");
}

// exemplo de chamada (coloca isto onde já tens os dados prontos):
// renderNowIcon(idTipoTempoDoIPMA, document.getElementById('sunrise').textContent, document.getElementById('sunset').textContent);

/* Sun times (coordenadas aproximadas – ajusta para tua estação) */
const LAT = 39.75,
  LON = -8.94;
function setSunTimes(date = new Date()) {
  if (typeof SunCalc === "undefined") {
    $("#sunrise").textContent = "—";
    $("#sunset").textContent = "—";
    return;
  }
  const t = SunCalc.getTimes(date, LAT, LON);
  const opt = { hour: "2-digit", minute: "2-digit" };
  $("#sunrise").textContent = t.sunrise.toLocaleTimeString("pt-PT", opt);
  $("#sunset").textContent = t.sunset.toLocaleTimeString("pt-PT", opt);
}

/* Previsão IPMA (3 dias) */
async function loadForecast() {
  try {
    const r = await fetch(IPMA_FORECAST, { cache: "no-store" });
    const j = await r.json();
    const days = j.data?.slice(0, 3) || [];
    const ul = $("#forecast");
    ul.innerHTML = "";

    days.forEach((d, i) => {
      const day = new Date(d.forecastDate);
      const label = day.toLocaleDateString("pt-PT", { weekday: "short" });

      // ícone (usa sempre versão “day” para cartões)
      const iconName = iconNameFromIpma(d.idWeatherType, /*isDaytime*/ true);

      const li = document.createElement("li");
      li.innerHTML = `
        <div class="d">${label}</div>
        <div class="ic">
          <svg class="bm-ico bm-ico--sm" viewBox="0 0 24 24" aria-hidden="true">
            <use href="#bm-icon-${iconName}"></use>
          </svg>
        </div>
        <div class="t">${Math.round(d.tMax)}° | ${Math.round(d.tMin)}°</div>
      `;
      ul.appendChild(li);

      // No 1.º item, aproveita e atualiza o ícone grande do topo
      if (i === 0) {
        const sunrise = $("#sunrise")?.textContent || "06:00";
        const sunset = $("#sunset")?.textContent || "21:00";
        renderNowIcon(d.idWeatherType, sunrise, sunset);
      }
    });
  } catch (e) {
    console.warn("IPMA falhou:", e);
  }
}

function appendLivePointToChart(j) {
  if (!chart) return;

  // timestamp “local”
  const t = new Date((j.ts_local ?? j.ts_utc).replace(" ", "T"));
  const last = chart.data.labels.at(-1);
  // se o ponto é igual/mais antigo, ignora
  if (last && t <= new Date(last)) return;

  // valores
  const temp = Number.isFinite(+j.temp_c) ? +j.temp_c : null;
  const rain = Number.isFinite(+j.rain_rate_mmph) ? +j.rain_rate_mmph : 0;

  chart.data.labels.push(
    t.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
  );
  chart.data.datasets[0].data.push(temp);
  chart.data.datasets[1].data.push(rain);

  // manter janela ~24h (se estiveres a receber 1 ponto/10min ~ 144; ajusta se preciso)
  const maxPoints = 200;
  while (chart.data.labels.length > maxPoints) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
    chart.data.datasets[1].data.shift();
  }

  chart.update("none"); // sem animação
}

/* Live */
async function loadLive() {
  const r = await fetch(LIVE_URL, {
    cache: "no-store",
    mode: "cors",
    credentials: "omit",
  });
  if (!r.ok) throw new Error("live " + r.status);
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
  if (j.stale) {
    flag.textContent = "Dados desatualizados";
    flag.className = "stale";
  } else {
    flag.textContent = "Estação online";
    flag.className = "ok";
  }

  setText("#temp", fmt(j.temp_c, 1));
  setText("#apparent", fmt(j.apparent_c ?? j.temp_c, 1));
  setText("#wind", fmt(j.wind_kmh, 0));
  setText("#winddir", degToDir(j.wind_dir_deg));
  setText("#gust", fmt(j.gust_kmh, 0));
  setText("#rh", fmt(j.rh_pct, 0) + "%");
  setText("#dew", fmt(j.dewpoint_c, 1) + "°");
  setText("#press", fmt(j.pressure_hpa, 0));
  setText("#uv", fmt(j.uv_index, 1));

  startCountdown(60000);
  appendLivePointToChart(j);
}

/* Histórico 24h -> gráfico */
let chart;
async function loadHistory() {
  const r = await fetch(HIST_URL, { cache: "no-store" });
  if (!r.ok) throw new Error("hist " + r.status);
  const rows = await r.json();

  // usa ts_local quando existir (string "YYYY-MM-DD HH:MM:SS" -> Date local)
  const toLocalDate = (x) => {
    if (x.ts_local) return new Date(x.ts_local.replace(" ", "T"));
    // fallback: ts_utc ISO ou "YYYY-MM-DD HH:MM:SS" tratado como UTC
    return new Date(
      x.ts_utc.endsWith("Z") ? x.ts_utc : x.ts_utc.replace(" ", "T") + "Z"
    );
  };

  const labels = rows.map(toLocalDate);
  const rawTemps = rows.map((x) =>
    Number.isFinite(+x.temp_c) ? +x.temp_c : null
  );
  const rainRate = rows.map((x) =>
    Number.isFinite(+x.rain_rate_mmph) ? +x.rain_rate_mmph : 0
  );

  // filtra lixo (NULL, < -10 ou > 55) -> gap no gráfico
  const temps = rawTemps.map((v) =>
    v == null || v < -10 || v > 55 ? null : Math.max(0, Math.min(43, v))
  );

  // chuva 24h (amostragem ~10 min => 1/6 h por ponto)
  const rain24 = rainRate.reduce((a, b) => a + b / 6, 0);
  $("#rain24").textContent = fmt(rain24, 1);

  const ctx = $("#histChart");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels.map((t) =>
        t.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
      ),
      datasets: [
        {
          type: "line",
          label: "Temperatura (°C)",
          data: temps, // <- null cria gap
          yAxisID: "y1",
          borderColor: "#000",
          backgroundColor: "rgba(0,0,0,0)",
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 0,
          spanGaps: false, // não ligar por cima de null
        },
        {
          type: "bar",
          label: "Precipitação (mm/h)",
          data: rainRate,
          yAxisID: "y2",
          backgroundColor: "#999",
          borderColor: "#000",
          borderWidth: 1,
          maxBarThickness: 18,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4, right: 8, bottom: 0, left: 4 } }, // menos espaço
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          grid: { color: "#00000014" }, // grelha mais suave
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
        },
        y1: {
          position: "left",
          grid: { color: "#00000014" },
          min: 0,
          max: 43,
          ticks: { stepSize: 5 },
        },
        y2: {
          position: "right",
          grid: { display: false },
          beginAtZero: true,
          suggestedMax: 10,
        },
      },
    },
  });
}

/* Boot */
async function boot() {
  try {
    await loadLive(); // garante #sunrise / #sunset
    await loadForecast(); // agora já há horas reais para o ícone
    await loadHistory(); // gráfico pode vir por fim
    setInterval(loadLive, 60000);
  } catch (err) {
    console.error(err);
  }
}

boot().catch(console.error);
