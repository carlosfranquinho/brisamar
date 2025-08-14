/* CONFIG */
const API_BASE = "https://meteomg-tunel.franquinho.info";
const LIVE_URL = `${API_BASE}/live`;
const HIST_URL = `${API_BASE}/history?hours=24`;
const METAR_URL = `${API_BASE}/metar-tgftp/LPMR`;
const IPMA_GLOBAL_ID = 1100900;
const IPMA_FORECAST = `https://api.ipma.pt/open-data/forecast/meteorology/cities/daily/${IPMA_GLOBAL_ID}.json`;
const PUSH_MS = 120000;
const CSSVARS = getComputedStyle(document.documentElement);
const ACCENT = (CSSVARS.getPropertyValue("--accent") || "#3b82f6").trim();
const ACCENT2 = (CSSVARS.getPropertyValue("--accent-2") || "#94a3b8").trim();

/* Icons */
const ICON_PATHS = {
  "clear-day": "icons/clear-day.svg",
  "clear-night": "icons/clear-night.svg",
  "partly-cloudy-day": "icons/partly-cloudy-day.svg",
  "partly-cloudy-night": "icons/partly-cloudy-night.svg",
  cloudy: "icons/cloudy.svg",
  overcast: "icons/cloudy.svg",
  drizzle: "icons/drizzle.svg",
  rain: "icons/rain.svg",
  "heavy-rain": "icons/heavy-rain.svg",
  thunder: "icons/thunder.svg",
  snow: "icons/snow.svg",
  sleet: "icons/sleet.svg",
  "freezing-rain": "icons/freezing-rain.svg",
  fog: "icons/fog.svg",
  wind: "icons/wind.svg",
  unknown: "icons/cloudy.svg",
};
function iconUrl(name) {
  return ICON_PATHS[name] || ICON_PATHS["unknown"];
}

// HISTÓRICO/GRÁFICO (globais)
let chart = null;
let HISTORY_WINDOW_POINTS = 0; // nº de pontos que representam as 24h iniciais
let chartLastTs = 0;

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

function iconNameFromMetarRaw(raw, isDaytime) {
  if (!raw) return "unknown";
  const r = " " + raw + " ";
  if (/\+TSRA|TSRA|VCTS|CB/.test(r)) return "thunder";
  if (/\+RA/.test(r)) return "heavy-rain";
  if (/FZRA|FZDZ/.test(r)) return "freezing-rain";
  if (/SN|SG|PL|GR/.test(r)) return "snow";
  if (/RA|SHRA/.test(r)) return "rain";
  if (/DZ/.test(r)) return "drizzle";
  if (/FG|BR|HZ/.test(r)) return "fog";
  if (/CAVOK|SKC|NSC/.test(r)) return isDaytime ? "clear-day" : "clear-night";
  if (/OVC|BKN/.test(r)) return "overcast";
  if (/SCT|FEW/.test(r))
    return isDaytime ? "partly-cloudy-day" : "partly-cloudy-night";
  return isDaytime ? "clear-day" : "clear-night";
}

async function loadMetarTGFTP() {
  try {
    const r = await fetch(METAR_URL, { cache: "no-store" });
    const j = await r.json();
    if (!j.ok) return;

    const sunrise = $("#sunrise")?.textContent || "06:00";
    const sunset = $("#sunset")?.textContent || "21:00";
    const day = isDay(Date.now(), sunrise, sunset);
    const name = iconNameFromMetarRaw(j.raw, day);

    const img = document.getElementById("bm-now-ico");
    if (img) {
      img.src = iconUrl(name);
      img.alt = name.replace(/-/g, " ");
    }
  } catch (e) {
    console.warn("METAR TGFTP falhou:", e);
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
  const img = document.getElementById("bm-now-ico");
  if (!img) return;

  img.src = iconUrl(name);
  img.alt = name.replace(/-/g, " ");

  // classes de estado (mantive a tua lógica)
  img.classList.remove("sunny", "alert", "neutral");
  if (
    [
      "clear-day",
      "clear-night",
      "partly-cloudy-day",
      "partly-cloudy-night",
    ].includes(name)
  ) {
    img.classList.add("sunny");
  } else if (["thunder", "heavy-rain"].includes(name)) {
    img.classList.add("alert");
  } else {
    img.classList.add("neutral");
  }
}

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
      const iconName = iconNameFromIpma(d.idWeatherType, /*isDaytime*/ true);

      const li = document.createElement("li");
      li.innerHTML = `
        <div class="d">${label}</div>
        <div class="ic">
          <img class="bm-ico bm-ico--sm" src="${iconUrl(
            iconName
          )}" alt="${iconName.replace(/-/g, " ")}" width="48" height="48">
        </div>
        <div class="t">${Math.round(d.tMax)}° | ${Math.round(d.tMin)}°</div>
      `;
      ul.appendChild(li);

      // Se quiseres que o ícone grande reflita a previsão de hoje (como já tinhas):
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
  if (!chart || !HISTORY_WINDOW_POINTS) return;

  // timestamp seguro
  const rawTs = j.ts_local || j.ts_utc;
  if (!rawTs) return;
  const t = new Date(
    rawTs.includes(" ") && !rawTs.endsWith("Z")
      ? rawTs.replace(" ", "T")
      : rawTs
  );
  const tms = t.getTime();

  // ignora fora de ordem
  if (chartLastTs && tms <= chartLastTs) return;

  // valores
  const temp = Number.isFinite(+j.temp_c) ? +j.temp_c : null;
  const rain = Number.isFinite(+j.rain_rate_mmph) ? +j.rain_rate_mmph : 0;

  chart.data.labels.push(
    t.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
  );
  chart.data.datasets[0].data.push(temp);
  if (temp !== null) {
    chart.data.datasets[0].hidden = false; // volta a mostrar se vier valor
  }
  chart.data.datasets[1].data.push(rain);
  chartLastTs = tms;

  // mantém a janela do tamanho original (≈24h)
  const maxPoints = HISTORY_WINDOW_POINTS || chart.data.labels.length;
  while (chart.data.labels.length > maxPoints) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
    chart.data.datasets[1].data.shift();
  }

  chart.update("none");
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

  setText("#temp", fmt(j.temp_c, 1));
  setText("#apparent", fmt(j.apparent_c ?? j.temp_c, 1));
  setText("#wind", fmt(j.wind_kmh, 0));
  setText("#winddir", degToDir(j.wind_dir_deg));
  setText("#gust", fmt(j.gust_kmh, 0));
  setText("#rh", fmt(j.rh_pct, 0) + "%");
  setText("#dew", fmt(j.dewpoint_c, 1) + "°");
  setText("#press", fmt(j.pressure_hpa, 0));
  setText("#uv", fmt(j.uv_index, 1));
  setText("#solar", fmt(j.solar_wm2, 0));
  setText("#tmax", fmt(j.temp_max_c, 0) + "°");
  setText("#tmin", fmt(j.temp_min_c, 0) + "°");

  if (j.rain_day_mm != null) setText("#rainToday", fmt(j.rain_day_mm, 1));

  const ts = localTime(j.ts_local ?? j.ts_utc);
  setSunTimes(ts);

  // legenda/estado
  const flag = $("#staleFlag");
  if (j.stale) {
    flag.textContent = "Dados desatualizados";
    flag.className = "stale";
  } else {
    flag.textContent = "Estação online";
    flag.className = "ok";
  }

  startCountdown(PUSH_MS);
  appendLivePointToChart(j);
}

/* Histórico 24h -> gráfico */
async function loadHistory() {
  const r = await fetch(HIST_URL, { cache: "no-store" });
  if (!r.ok) throw new Error("hist " + r.status);
  const rows = await r.json(); // <- rows SÓ aqui

  // helper: ts_local "YYYY-MM-DD HH:MM:SS" -> Date local; fallback para ts_utc
  const toLocalDate = (x) => {
    if (x.ts_local) return new Date(x.ts_local.replace(" ", "T"));
    return new Date(
      x.ts_utc.endsWith("Z") ? x.ts_utc : x.ts_utc.replace(" ", "T") + "Z"
    );
  };

  // arrays de datas/labels
  const labelDates = rows.map(toLocalDate);
  const labels = labelDates.map((t) =>
    t.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
  );

  // guarda janela e último timestamp real (para o appendLivePointToChart)
  HISTORY_WINDOW_POINTS = labels.length;
  chartLastTs = labelDates.at(-1)?.getTime() || 0;

  // datasets
  const rawTemps = rows.map((x) =>
    Number.isFinite(+x.temp_c) ? +x.temp_c : null
  );
  const rainRate = rows.map((x) =>
    Number.isFinite(+x.rain_rate_mmph) ? +x.rain_rate_mmph : 0
  );

  // filtra lixo -> gaps
  const temps = rawTemps.map((v) =>
    v == null || v < -10 || v > 55 ? null : Math.max(0, Math.min(43, v))
  );
  const allTempsNull = temps.every((v) => v === null);

  // chuva 24h aprox. (10 min ≈ 1/6 h)
  const rain24 = rainRate.reduce((a, b) => a + b / 6, 0);
  setText("#rain24", fmt(rain24, 1));

  const ctx = $("#histChart");
  if (!ctx) return;

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels, // <- usa as labels já string
      datasets: [
        {
          type: "line",
          label: "Temperatura (°C)",
          data: temps,
          yAxisID: "y1",
          borderColor: ACCENT,
          backgroundColor: "rgba(0,0,0,0)",
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 0,
          spanGaps: true, // <- permite “buracos” sem tentar desenhar
          hidden: allTempsNull, // <- se tudo null, não mostra a série
        },
        {
          type: "bar",
          label: "Precipitação (mm/h)",
          data: rainRate,
          yAxisID: "y2",
          backgroundColor: ACCENT2,
          borderColor: ACCENT2,
          borderWidth: 1,
          maxBarThickness: 18,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4, right: 8, bottom: 0, left: 4 } },
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: {
          grid: { color: "#00000014" },
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
    await loadMetarTGFTP(); // usa METAR (observado) para o ícone atual
    await loadForecast(); // agora já há horas reais para o ícone
    await loadHistory(); // gráfico pode vir por fim
    setInterval(() => {
      loadLive().catch(console.error);
    }, PUSH_MS);
  } catch (err) {
    console.error(err);
  }
}

boot().catch(console.error);
