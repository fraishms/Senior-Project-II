import { api, clearToken, getToken } from "./api.js";

// Chart.js is loaded from a CDN in dashboard.html.
declare const Chart: any;

interface WeekRecord { weekStart: string; units: number }
interface Dashboard {
  history: WeekRecord[];
  averageWeeklyUnits: number;
  comparison: { current: number; previous: number; change: number; changePercent: number | null } | null;
  alert: { type: string; message: string } | null;
  tips: string[];
  alerts?: { id: number; message: string; createdAt: string }[];
  predictions?: { predictionMonth: string; predictedUnits: number; predictedBill: number }[];
}
interface Prediction { predictionMonth: string; predictedUnits: number; predictedBill: number; lowerUnits?: number; upperUnits?: number; tariffMode?: string; flatRate?: number | null; tierLimitKwh?: number; baseRatePerKwh?: number; highRatePerKwh?: number }

if (!getToken()) window.location.href = "login.html";

const $ = (id: string) => document.getElementById(id) as HTMLElement;
let chart: any = null;

function setText(id: string, text: string): void { $(id).textContent = text; }

async function loadDashboard(): Promise<void> {
  const d = await api<Dashboard>("/dashboard");

  setText("avg", `${d.averageWeeklyUnits} kWh`);
  if (d.comparison) {
    const pct = d.comparison.changePercent === null ? "" : ` (${d.comparison.changePercent > 0 ? "+" : ""}${d.comparison.changePercent}%)`;
    setText("compare", `${d.comparison.current} kWh vs ${d.comparison.previous} kWh last week${pct}`);
  } else {
    setText("compare", "Add at least two weeks to compare.");
  }

  const alertBox = $("alert");
  alertBox.hidden = !d.alert;
  alertBox.textContent = d.alert ? d.alert.message : "";

  const tips = $("tips");
  tips.replaceChildren(...d.tips.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
  $("alertHistory").replaceChildren(...(d.alerts ?? []).map((a) => Object.assign(document.createElement("li"), { textContent: `${a.createdAt}: ${a.message}` })));
  $("predictionHistory").replaceChildren(...(d.predictions ?? []).map((p) => Object.assign(document.createElement("li"), { textContent: `${p.predictionMonth}: ${p.predictedUnits} kWh, ${p.predictedBill} SAR` })));

  const labels = d.history.map((h) => h.weekStart);
  const data = d.history.map((h) => h.units);
  const canvas = $("chart") as HTMLCanvasElement;
  if (chart) chart.destroy();
  chart = new Chart(canvas, {
    type: "line",
    data: { labels, datasets: [{ label: "Weekly usage (kWh)", data, borderColor: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(), tension: 0.25 }] },
    options: { responsive: true, scales: { y: { beginAtZero: true } } },
  });
  const table = $("historyRows");
  table.replaceChildren(...d.history.slice().reverse().map((record) => {
    const tr = document.createElement("tr");
    const week = document.createElement("td"); week.textContent = record.weekStart;
    const units = document.createElement("td"); units.textContent = String(record.units);
    const editCell = document.createElement("td");
    const edit = document.createElement("button"); edit.textContent = "Edit"; edit.className = "btn btn-outline";
    edit.addEventListener("click", async () => {
      const value = window.prompt(`Weekly kWh for ${record.weekStart}`, String(record.units));
      if (value === null) return;
      try { await api(`/consumption/${record.weekStart}`, { method: "PUT", body: { units: value } }); await refreshViews(); }
      catch (e) { setText("entryError", e instanceof Error ? e.message : "Could not update record"); }
    });
    editCell.append(edit);
    const deleteCell = document.createElement("td");
    const remove = document.createElement("button"); remove.textContent = "Delete"; remove.className = "btn btn-outline";
    remove.addEventListener("click", async () => {
      if (!window.confirm(`Delete the week starting ${record.weekStart}?`)) return;
      try { await api(`/consumption/${record.weekStart}`, { method: "DELETE" }); await refreshViews(); }
      catch (e) { setText("entryError", e instanceof Error ? e.message : "Could not delete record"); }
    });
    deleteCell.append(remove);
    tr.append(week, units, editCell, deleteCell); return tr;
  }));
  await loadMonthly();
}

async function loadMonthly(): Promise<void> {
  const result = await api<{ months: { month: string; units: number; weeks: number; partial: boolean }[]; comparison: { current: { month: string; units: number }; previous: { month: string; units: number }; changePercent: number | null } | null }>("/dashboard/monthly");
  const list = $("monthlyList");
  list.replaceChildren(...result.months.map((m) => Object.assign(document.createElement("li"), { textContent: `${m.month}: ${m.units} kWh${m.partial ? ` (${m.weeks} weeks, partial)` : ""}` })));
  const compare = result.comparison;
  setText("monthlyComparison", compare ? `${compare.current.month}: ${compare.current.units} kWh, ${compare.changePercent === null ? "change unavailable" : `${compare.changePercent >= 0 ? "up" : "down"} ${Math.abs(compare.changePercent)}%`} from ${compare.previous.month}.` : "Add multiple months to compare.");
}

async function loadSettings(): Promise<void> {
  const me = await api<{ fullName: string; email: string; pricePerKwh: number | null; tariffMode: string }>("/me");
  ($("fullName") as HTMLInputElement).value = me.fullName;
  ($("pricePerKwh") as HTMLInputElement).value = me.pricePerKwh === null ? "" : String(me.pricePerKwh);
  const tiered = document.querySelector<HTMLInputElement>('input[name="tariffMode"][value="tiered"]')!;
  const flat = document.querySelector<HTMLInputElement>('input[name="tariffMode"][value="flat_override"]')!;
  tiered.checked = me.tariffMode === "tiered";
  flat.checked = me.tariffMode === "flat_override";
  ($("pricePerKwh") as HTMLInputElement).disabled = !flat.checked;
}

async function refreshViews(): Promise<void> { await loadDashboard(); await loadSettings(); }

($("entryForm") as HTMLFormElement).addEventListener("submit", async (event) => {
  event.preventDefault();
  const err = $("entryError");
  const saveButton = ($("entryForm") as HTMLFormElement).querySelector<HTMLButtonElement>('button[type="submit"]')!;
  saveButton.disabled = true;
  err.textContent = "";
  try {
    await api("/consumption", {
      method: "POST",
      body: {
        date: ($("date") as HTMLInputElement).value,
        units: ($("units") as HTMLInputElement).value,
      },
    });
    ($("entryForm") as HTMLFormElement).reset();
    await refreshViews();
  } catch (e) {
    err.textContent = e instanceof Error ? e.message : "Could not save";
  } finally { saveButton.disabled = false; }
});

$("predictBtn").addEventListener("click", async () => {
  const out = $("prediction");
  out.textContent = "Calculating…";
  try {
    const p = await api<Prediction>("/predict", { method: "POST" });
    const tariffLabel = p.tariffMode === "flat_override"
      ? `your flat rate of ${p.flatRate} SAR/kWh`
      : `the first ${p.tierLimitKwh} kWh at ${p.baseRatePerKwh} SAR/kWh and excess at ${p.highRatePerKwh} SAR/kWh`;
    out.textContent = `Next month: about ${p.predictedUnits} kWh (range ${p.lowerUnits ?? p.predictedUnits} to ${p.upperUnits ?? p.predictedUnits}), estimated bill ${p.predictedBill} SAR using ${tariffLabel}.`;
  } catch (e) {
    out.textContent = e instanceof Error ? e.message : "Prediction failed";
  }
});

$("logout").addEventListener("click", () => {
  clearToken();
  window.location.href = "index.html";
});

document.querySelectorAll<HTMLInputElement>('input[name="tariffMode"]').forEach((input) => input.addEventListener("change", () => {
  ($("pricePerKwh") as HTMLInputElement).disabled = document.querySelector<HTMLInputElement>('input[name="tariffMode"]:checked')?.value !== "flat_override";
}));

($("settingsForm") as HTMLFormElement).addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = ($("settingsSave") as HTMLButtonElement); button.disabled = true;
  const mode = document.querySelector<HTMLInputElement>('input[name="tariffMode"]:checked')?.value;
  const rawFlat = ($("pricePerKwh") as HTMLInputElement).value;
  try {
    await api("/me", { method: "PATCH", body: { fullName: ($("fullName") as HTMLInputElement).value, tariffMode: mode, ...(mode === "flat_override" ? { pricePerKwh: Number(rawFlat) } : {}) } });
    setText("settingsMessage", mode === "flat_override" ? "Flat tariff override saved." : "Tiered tariff saved.");
    await loadSettings();
  }
  catch (e) { setText("settingsMessage", e instanceof Error ? e.message : "Could not save settings"); }
  finally { button.disabled = false; }
});

loadDashboard().then(loadSettings).catch((e) => { setText("compare", e instanceof Error ? e.message : "Could not load data"); $("loadError").hidden = false; });
