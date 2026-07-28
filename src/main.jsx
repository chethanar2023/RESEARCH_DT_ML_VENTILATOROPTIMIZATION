import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CloudSun,
  Database,
  FlaskConical,
  Gauge,
  HeartPulse,
  History,
  Box,
  LayoutDashboard,
  Link2,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Stethoscope,
  TestTube2,
  Wind,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Customized,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell
} from "recharts";

const TWIN_HISTORY_WINDOW = 48;
const TWIN_T_SPREAD = 3;

function twinChartCoords(xAxisMap, yAxisMap, points) {
  if (!points?.length || !xAxisMap || !yAxisMap) return [];

  const xAxis = Object.values(xAxisMap)[0];
  const yAxis = Object.values(yAxisMap)[0];
  if (!xAxis?.scale || !yAxis?.scale) return [];

  return points
    .map((row) => {
      const x = xAxis.scale(row.t);
      const y = yAxis.scale(row.PredictedSpO2);
      if (x == null || y == null || Number.isNaN(x) || Number.isNaN(y)) return null;
      return [x, y];
    })
    .filter(Boolean);
}

function TwinTrajectoryStroke({ xAxisMap, yAxisMap, points }) {
  const coords = twinChartCoords(xAxisMap, yAxisMap, points);
  if (coords.length < 2) return null;

  const path = coords
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`)
    .join("");

  return (
    <g className="twin-trajectory-stroke" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke="#a855f7"
        strokeWidth={2}
        strokeDasharray="5 5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function TwinTrajectoryDots({ xAxisMap, yAxisMap, points }) {
  const coords = twinChartCoords(xAxisMap, yAxisMap, points);
  if (!coords.length) return null;

  return (
    <g className="twin-trajectory-dots" aria-hidden="true">
      {coords.map(([x, y], index) => (
        <circle
          key={`twin-dot-${index}`}
          cx={x}
          cy={y}
          r={4}
          fill="#a855f7"
          stroke="#c084fc"
          strokeWidth={1}
        />
      ))}
    </g>
  );
}

function buildTwinFutureRows(observedLength, twinTrajectory, upper, lower) {
  const futurePoints = twinTrajectory.slice(1).map((spo2, i) => {
    const bandIdx = i + 1;
    const predicted = Number(spo2);
    const lo = lower[bandIdx] != null ? Number(lower[bandIdx]) : predicted;
    const hi = upper[bandIdx] != null ? Number(upper[bandIdx]) : predicted;
    return {
      t: observedLength + (i + 1) * TWIN_T_SPREAD,
      SpO2: null,
      HR: null,
      MAP: null,
      RespRate: null,
      PredictedSpO2: predicted,
      UncertaintyRange: [lo, hi],
    };
  });
  return futurePoints;
}
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import { api, API_BASE } from "./api";
import FiwarePage from "./FiwarePage";

import "./styles.css";

const pages = [
  { id: "live", label: "Dashboard", icon: LayoutDashboard },
  { id: "fiware", label: "Digital Twin", icon: Wind },
  { id: "tests", label: "Test Cases", icon: FlaskConical },
  { id: "models", label: "Model Metrics", icon: BarChart3 },
  { id: "audit", label: "Audit", icon: ShieldCheck },
];

const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "--" : Number(v).toFixed(d));
const pct = (v, d = 1) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "--" : `${(Number(v) * 100).toFixed(d)}%`);
const riskTone = (v) => (Number(v) >= 0.7 ? "danger" : Number(v) >= 0.25 ? "warning" : "good");
const alertTone = (level) => String(level || "stable").toLowerCase();

function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const reload = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      setState({ data: null, loading: false, error });
      return null;
    }
  };
  useEffect(() => {
    reload();
  }, deps);
  return { ...state, reload };
}

function App() {
  const [page, setPage] = useState("live");
  const patients = useAsync(api.patients, []);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (!selected && patients.data?.patients?.length) {
      setSelected(String(patients.data.patients[0]));
    }
  }, [patients.data, selected]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandIcon"><HeartPulse size={24} /></div>
          <div>
            <div className="brandName">Ventilator OS</div>
            <div className="brandMeta">Digital Twin & Blockchain Audit</div>
          </div>
        </div>
        <div className="topControls">
          <label>Patient ID:</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="select patientSelect">
            {(patients.data?.patients || []).map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
          <span className="chainStatus"><Link2 size={15} /> Chain Valid</span>
        </div>
        <nav>
          {pages.map((item) => {
            const Icon = item.icon;
            if (item.external) {
              return (
                <a key={item.id} className="navExternal" href={item.external} target="_blank" rel="noreferrer">
                  <Icon size={18} />
                  {item.label}
                </a>
              );
            }
            return (
              <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}>
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="apiBox">
          <Server size={16} />
          <div>
            <span>API</span>
            <strong>{API_BASE.replace("http://", "")}</strong>
          </div>
        </div>
      </aside>
      <main>
        {page === "live" && <LivePage selected={selected} setSelected={setSelected} patients={patients} />}
        {page === "fiware" && <FiwarePage />}
        {page === "tests" && <TestLabPage />}
        {page === "models" && <ModelMetricsPage />}
        {page === "audit" && <AuditPage />}
      </main>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="pageHeader">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="actions">{actions}</div>
    </header>
  );
}

function Button({ children, onClick, variant = "primary", disabled }) {
  return (
    <button className={`btn ${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Metric({ label, value, note, tone = "" }) {
  return (
    <section className="metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      {note && <small>{note}</small>}
    </section>
  );
}

function Empty({ icon: Icon = Database, title, text }) {
  return (
    <div className="empty">
      <Icon size={34} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function LoadingBlock({ label = "Loading" }) {
  return (
    <div className="empty">
      <Loader2 className="spin" size={32} />
      <strong>{label}</strong>
    </div>
  );
}

function LivePage({ selected, setSelected, patients }) {
  const [history, setHistory] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [multiRisk, setMultiRisk] = useState(null);
  const [riskHistory, setRiskHistory] = useState([]);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const historyRef = useRef([]);
  const streamBusyRef = useRef(false);
  const health = useAsync(api.health, []);
  const connectionError = patients.error || health.error;

  const updateHistory = (rows) => {
    historyRef.current = rows;
    setHistory(rows);
  };

  const pushRiskHistory = (classification) => {
    if (!classification) return;
    setRiskHistory((prev) => {
      const entry = {
        t: prev.length + 1,
        Hypoxia_Risk: classification.Hypoxia_Risk?.probability ?? null,
        Tachycardia_Risk: classification.Tachycardia_Risk?.probability ?? null,
        Hypotension_Risk: classification.Hypotension_Risk?.probability ?? null,
        Tachypnea_Risk: classification.Tachypnea_Risk?.probability ?? null,
        VILI_Risk: classification.VILI_Risk?.probability ?? null,
        Shock_Risk: classification.Shock_Risk?.probability ?? null,
      };
      return [...prev.slice(-19), entry];
    });
  };

  const loadPatient = async () => {
    if (!selected) return;
    setLoadingPatient(true);
    try {
      const hist = await api.history(selected);
      const rows = hist.history || [];
      updateHistory(rows);
      const latest = rows[rows.length - 1];
      if (latest) {
        const rec = await api.recommend(selected, { ...latest, history: rows.slice(-96) });
        setRecommendation(rec);
        try {
          const risk = await api.risks(selected, rows.slice(-64));
          setMultiRisk(risk);
          pushRiskHistory(risk.predictions?.classification);
        } catch {
          setMultiRisk(null);
        }
      }
    } finally {
      setLoadingPatient(false);
    }
  };

  const advanceStream = async () => {
    if (!selected || !historyRef.current.length || streamBusyRef.current) return;
    streamBusyRef.current = true;
    try {
      const tickResult = await api.tick(selected);
      const latest = tickResult.latest_record;
      if (!latest) return;
      const nextHistory = [...historyRef.current, latest].slice(-96);
      updateHistory(nextHistory);

      if (nextHistory.length >= 12) {
        setPredicting(true);
        const recent96 = nextHistory.slice(-96);
        const [recResult, riskResult] = await Promise.allSettled([
          api.recommend(selected, { ...latest, history: recent96 }),
          api.risks(selected, recent96.slice(-64)),
        ]);

        if (recResult.status === "fulfilled") {
          setRecommendation(recResult.value);
        }
        if (riskResult.status === "fulfilled") {
          setMultiRisk(riskResult.value);
          pushRiskHistory(riskResult.value.predictions?.classification);
        }
      }
    } catch (error) {
      console.warn("Live stream tick failed", error);
    } finally {
      streamBusyRef.current = false;
      setPredicting(false);
    }
  };

  useEffect(() => {
    loadPatient();
  }, [selected]);

  useEffect(() => {
    if (!selected || !streamingEnabled) return undefined;
    const interval = setInterval(() => {
      advanceStream();
    }, 2000);
    return () => clearInterval(interval);
  }, [selected, streamingEnabled]);

  const latest = history[history.length - 1] || {};
  const chartData = useMemo(() => {
    const observedRows = history.slice(-TWIN_HISTORY_WINDOW);
    const observed = observedRows.map((row, i) => ({
      t: i + 1,
      SpO2: Number(row.SpO2),
      HR: Number(row.HR),
      MAP: Number(row.MAP),
      RespRate: Number(row.RespRate),
      PredictedSpO2: null,
      UncertaintyRange: null,
    }));

    if (!observed.length) return observed;

    const latestSpo2 = Number(observedRows[observedRows.length - 1]?.SpO2);
    if (Number.isNaN(latestSpo2)) return observed;

    const bridgePoint = {
      ...observed[observed.length - 1],
      PredictedSpO2: latestSpo2,
    };

    const twin = recommendation?.twin_simulation;
    const twinTrajectory = twin?.trajectory;
    if (Array.isArray(twinTrajectory) && twinTrajectory.length > 1) {
      const upper = twin.upper_band || [];
      const lower = twin.lower_band || [];
      bridgePoint.UncertaintyRange = [
        lower[0] != null ? Number(lower[0]) : latestSpo2,
        upper[0] != null ? Number(upper[0]) : latestSpo2,
      ];

      const twinFuture = buildTwinFutureRows(observed.length, twinTrajectory, upper, lower);
      return [...observed.slice(0, -1), bridgePoint, ...twinFuture];
    }

    const forecastSpo2 = Number(recommendation?.pred_next_spo2);
    if (Number.isNaN(forecastSpo2)) return observed;

    bridgePoint.UncertaintyRange = [latestSpo2, latestSpo2];
    const projection = Array.from({ length: 5 }, (_, index) => {
      const step = index + 1;
      const progress = step / 5;
      const predicted = latestSpo2 + (forecastSpo2 - latestSpo2) * progress;
      const spread = 0.45 + progress * 0.9;
      return {
        t: observed.length + step * TWIN_T_SPREAD,
        SpO2: null,
        HR: null,
        MAP: null,
        RespRate: null,
        PredictedSpO2: predicted,
        UncertaintyRange: [predicted - spread, predicted + spread],
      };
    });

    return [...observed.slice(0, -1), bridgePoint, ...projection];
  }, [history, recommendation]);

  const twinAnchorPoints = useMemo(
    () => chartData.filter((row) => row.PredictedSpO2 != null),
    [chartData],
  );

  return (
    <>
      <PageHeader
        eyebrow="Clinical dashboard"
        title="Live Ventilator Digital Twin"
        description="Monitor patient state, forecasts, treatment recommendations, risk scores, and digital twin replay from one operational view."
        actions={
          <>
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className="select">
              {(patients.data?.patients || []).map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
            <Button onClick={loadPatient} disabled={loadingPatient}><RefreshCw size={16} /> Refresh</Button>
            <Button
              variant="secondary"
              onClick={() => setStreamingEnabled((current) => !current)}
            >
              {streamingEnabled ? "Live stream On" : "Live stream Off"}
            </Button>
          </>
        }
      />

      {connectionError ? (
        <section className="panel xl">
          <Empty
            icon={AlertTriangle}
            title="API connection failed"
            text={`Unable to reach ${API_BASE}. Start the backend on port 8000, then click Reconnect.`}
          />
          <div className="actions">
            <Button
              onClick={async () => {
                await Promise.all([patients.reload(), health.reload()]);
              }}
            >
              <RefreshCw size={16} /> Reconnect API
            </Button>
          </div>
        </section>
      ) : null}

      {!connectionError && (patients.data?.patients || []).length === 0 ? (
        <section className="panel xl">
          <Empty
            icon={Database}
            title="No patients available"
            text="Patient list is empty. Check /patients in the API and verify dataset loading in /health."
          />
        </section>
      ) : null}

      <section className="dashboardGrid">
        <div className="leftColumn">
          <section className="grid four vitalsGrid">
            <Metric label="SpO2" value={`${fmt(latest.SpO2)}%`} tone={Number(latest.SpO2) < 92 ? "danger" : "good"} note="Observed" />
            <Metric label="HR" value={fmt(latest.HR, 0)} note="BPM" />
            <Metric label="MAP" value={fmt(latest.MAP, 0)} note="mmHg" />
            <Metric label="Resp Rate" value={fmt(latest.RespRate, 0)} note="breaths/min" />
          </section>

          <div className="panel trajectoryPanel">
            <div className="panelHead">
              <h2>Patient Trajectory</h2>
              <div className="chartLegend">
                <span className="legendChip blue">Historical</span>
                <span className="legendChip purple">Predicted (Twin)</span>
                <span className="legendChip violet">± Uncertainty</span>
              </div>
            </div>
            {loadingPatient ? <LoadingBlock label="Loading patient stream" /> : (
              <ResponsiveContainer width="100%" height={430}>
                <ComposedChart data={chartData} margin={{ top: 12, right: 18, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="spo2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,.14)" vertical={false} />
                  <XAxis dataKey="t" stroke="#5d6b82" tick={false} axisLine={false} />
                  <YAxis stroke="#68758a" domain={[90, 100]} ticks={[95, 100]} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(148,163,184,.25)", borderRadius: 8 }} />
                  <Area
                    type="monotone"
                    dataKey="SpO2"
                    stroke="#3b82f6"
                    fill="url(#spo2)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="UncertaintyRange"
                    stroke="none"
                    fill="rgba(168, 85, 247, 0.18)"
                    connectNulls
                    isAnimationActive={false}
                  />
                  {twinAnchorPoints.length > 1 ? (
                    <Customized
                      component={(chartProps) => (
                        <>
                          <TwinTrajectoryStroke {...chartProps} points={twinAnchorPoints} />
                          <TwinTrajectoryDots {...chartProps} points={twinAnchorPoints} />
                        </>
                      )}
                    />
                  ) : null}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="rightStack">
          <ClinicalDecisionPanel selected={selected} recommendation={recommendation} multiRisk={multiRisk} predicting={predicting} />
          <ThreeDPanel latest={latest} recommendation={recommendation} />
          <AuditLedgerCard selected={selected} />
        </div>
      </section>

      <section className="panel xl">
        <div className="panelHead">
          <h2>Risk trend</h2>
          <span>Realtime risk probability forecast over recent ticks</span>
        </div>
        {riskHistory.length === 0 ? (
          <Empty title="Risk trend unavailable" text="Wait for the live stream to collect multi-risk predictions." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={riskHistory}>
              <CartesianGrid stroke="rgba(148,163,184,.16)" vertical={false} />
              <XAxis dataKey="t" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[0, 1]} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(148,163,184,.25)", borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="Hypoxia_Risk" stroke="#f97316" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Tachycardia_Risk" stroke="#fb7185" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Hypotension_Risk" stroke="#34d399" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Tachypnea_Risk" stroke="#60a5fa" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="VILI_Risk" stroke="#c084fc" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Shock_Risk" stroke="#f43f5e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="grid two">
        <TwinReplayPanel selected={selected} history={history} recommendation={recommendation} />
      </section>
    </>
  );
}
function ClinicalDecisionPanel({ selected, recommendation, multiRisk, predicting }) {
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const regression = multiRisk?.predictions?.regression || {};
  const classification = multiRisk?.predictions?.classification || {};
  const explainability = [
    ["SpO2 (Current)", recommendation?.pred_next_spo2 ? 0.2 : 0],
    ["PEEP Setting", recommendation?.proposed?.PEEP ? 0.4 : 0],
    ["Heart Rate", regression?.Next_HR?.prediction ? 0.1 : 0],
  ];

  const handleDecision = async (actionType) => {
    if (!selected) return;
    setSubmitting(true);
    setStatusMessage(null);
    try {
      let notes = "";
      if (actionType === "accept") {
        notes = "Clinician accepted RL co-pilot recommendation.";
      } else if (actionType === "override") {
        const promptText = window.prompt("Enter clinical justification for overriding this recommendation:");
        if (promptText === null) {
          // Clinician clicked Cancel
          setSubmitting(false);
          return;
        }
        notes = promptText.trim() || "Clinician overrode recommendation.";
      }

      const payload = {
        action: actionType,
        notes: notes,
        settings: recommendation?.proposed || {},
      };

      const block = await api.auditAction(selected, payload);
      setStatusMessage({
        type: "success",
        text: `Logged: Block #${block.index || block.block_index || "Valid"} verified on ledger!`,
      });
    } catch (err) {
      console.error(err);
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to commit action to audit ledger.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel decisionPanel">
      <div className="panelHead">
        <h2><Stethoscope size={18} /> Clinical Decision Support</h2>
        <span className={`chip ${predicting ? 'warning' : 'good'}`}>
          {predicting ? 'Updating' : 'Stable'}
        </span>
      </div>
      <div className="forecastBox">
        <div className="panelHead mini">
          <h3>Predictive Forecast</h3>
          <span className="chip warning">{recommendation ? "Active" : "Pending"}</span>
        </div>
        <div className="grid two compact">
          <Metric label="Pred. Next SpO2" value={`${fmt(recommendation?.pred_next_spo2)}%`} />
          <Metric label="Hypoxia Risk" value={pct(recommendation?.hypoxia_prob)} tone={riskTone(recommendation?.hypoxia_prob)} />
        </div>
        <p className="decisionHint">Forecast uses current patient stream and recent trajectory data.</p>
      </div>
      <h3>Proposed Adjustments</h3>
      <SettingsGrid settings={recommendation?.proposed} />
      <div className="rationale">
        <h3>Rationale</h3>
        <p>{recommendation?.rationale || "Patient stable, maintaining current settings."}</p>
      </div>
      <div className="riskList compactBars">
        <h3>Model Explainability</h3>
        {explainability.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <div className="bar"><i style={{ width: `${Math.max(8, Number(value) * 100)}%` }} /></div>
            <strong>{Number(value) >= 0 ? `+${Number(value).toFixed(1)}` : Number(value).toFixed(1)}</strong>
          </div>
        ))}
      </div>
      {statusMessage && (
        <div style={{
          marginTop: '12px',
          padding: '10px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          border: '1px solid',
          borderColor: statusMessage.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
          background: statusMessage.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          color: statusMessage.type === 'success' ? '#4ade80' : '#fca5a5',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}
      <div className="decisionActions">
        <Button variant="accept" onClick={() => handleDecision("accept")} disabled={submitting || !recommendation}>
          <CheckCircle2 size={16} /> {submitting ? "Signing..." : "Accept"}
        </Button>
        <Button variant="override" onClick={() => handleDecision("override")} disabled={submitting || !recommendation}>
          <Activity size={16} /> {submitting ? "Signing..." : "Override"}
        </Button>
      </div>
    </div>
  );
}

function AuditLedgerCard({ selected }) {
  return (
    <div className="panel ledgerPanel">
      <div className="panelHead">
        <h2><Link2 size={18} /> Audit Ledger</h2>
        <span><ShieldCheck size={15} /> Verify</span>
      </div>
      <div className="table">
        <div><span>Patient</span><strong>{selected || "--"}</strong></div>
        <div><span>Status</span><strong className="good">Chain Valid</strong></div>
      </div>
    </div>
  );
}
function SettingsGrid({ settings }) {
  const rows = settings || {};
  return (
    <div className="settingsGrid">
      {["PEEP", "FiO2", "TidalVol"].map((key) => (
        <div key={key}>
          <span>{key}</span>
          <strong>{fmt(rows[key])}</strong>
        </div>
      ))}
    </div>
  );
}

function MultiRiskPanel({ data }) {
  const regression = data?.predictions?.regression || {};
  const classification = data?.predictions?.classification || {};
  return (
    <div className="panel">
      <div className="panelHead">
        <h2>Multi-Risk LSTM</h2>
        <span className="chip">{data?.source || "not loaded"}</span>
      </div>
      {!data ? <Empty title="Multi-risk unavailable" text="The page still works with recommendation output. Train/load multi-risk artifacts to populate this panel." /> : (
        <>
          <h3>Next Vitals</h3>
          <div className="table">
            {Object.entries(regression).map(([k, v]) => (
              <div key={k}><span>{k.replaceAll("_", " ")}</span><strong>{fmt(v.prediction)}</strong></div>
            ))}
          </div>
          <h3>Risk Heads</h3>
          <div className="riskList">
            {Object.entries(classification).map(([k, v]) => (
              <div key={k}>
                <span>{k.replaceAll("_", " ")}</span>
                <div className="bar"><i style={{ width: `${Math.min(100, Number(v.probability) * 100)}%` }} /></div>
                <strong className={v.risk ? "danger" : "good"}>{pct(v.probability)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TwinReplayPanel({ selected, history, recommendation }) {
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const run = async () => {
    if (!history.length || !recommendation?.proposed) return;
    setRunning(true);
    try {
      const latest = history[history.length - 1];
      const data = await api.twinReplay({
        stay_id: Number(selected),
        history: history.slice(-32),
        current_spo2: latest.SpO2,
        proposed: recommendation.proposed,
        steps: 8,
        noise_scale: 0,
      });
      setResult(data.result);
    } finally {
      setRunning(false);
    }
  };
  const trajectory = (result?.trajectory || []).map((v, i) => ({ step: i, SpO2: v }));
  return (
    <div className="panel">
      <div className="panelHead">
        <h2>Digital Twin Replay</h2>
        <Button onClick={run} disabled={running || !recommendation}><TestTube2 size={16} /> Simulate</Button>
      </div>
      {!result ? <Empty icon={Wind} title="Replay ready" text="Run a deterministic replay using the current PPO recommendation." /> : (
        <>
          <div className="grid three compact">
            <Metric label="Mean SpO2" value={`${fmt(result.mean_spo2)}%`} />
            <Metric label="Delta SpO2" value={fmt(result.delta_spo2)} tone={Number(result.delta_spo2) < 0 ? "danger" : "good"} />
            <Metric label="Uncertainty" value={fmt(result.uncertainty)} />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trajectory}>
              <CartesianGrid stroke="rgba(148,163,184,.16)" vertical={false} />
              <XAxis dataKey="step" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[70, 100]} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(148,163,184,.25)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="SpO2" stroke="#22d3ee" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

function ThreeDPanel({ latest, recommendation }) {
  const mountRef = useRef(null);
  const modelRef = useRef({ screen: null, knobs: [], body: null, group: null });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 360;
    const height = 300;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 1.2, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(6, 8, 4);
    scene.add(dir);

    const hemi = new THREE.HemisphereLight(0x88b6ff, 0x0f172a, 0.35);
    scene.add(hemi);

    const group = new THREE.Group();
    scene.add(group);
    modelRef.current.group = group;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.26, 0.48), bodyMat);
    body.castShadow = true;
    body.position.y = 0.04;
    group.add(body);
    modelRef.current.body = body;

    const screenMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x1e40af, emissiveIntensity: 0.5 });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.045), screenMat);
    screen.position.set(0, 0.55, 0.255);
    group.add(screen);
    modelRef.current.screen = screen;

    const panelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.25, roughness: 0.6 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.54, 0.05), panelMat);
    panel.position.set(0, 0.05, 0.27);
    group.add(panel);

    const knobMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.8, roughness: 0.25 });
    for (let i = -1; i <= 1; i += 1) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 24), knobMat);
      knob.position.set(i * 0.24, -0.12, 0.32);
      knob.rotation.x = Math.PI / 2;
      group.add(knob);
      modelRef.current.knobs.push(knob);
    }

    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.3, roughness: 0.45 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.88, 16), tubeMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0.53, 0.48, 0);
    group.add(tube);

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.92), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.2 }));
    base.position.y = -0.75;
    group.add(base);

    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    group.position.sub(center);
    group.position.y += 0.1;

    camera.lookAt(0, 0, 0);

    const colladaLoader = new ColladaLoader();
    colladaLoader.load(
      "/model/Ventilator.dae",
      (collada) => {
        if (collada?.scene) {
          group.clear();
          const model = collada.scene;
          model.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
              if (node.material) {
                node.material.metalness ??= 0.4;
                node.material.roughness ??= 0.7;
              }
            }
          });
          model.scale.set(0.7, 0.7, 0.7);
          group.add(model);
          const box2 = new THREE.Box3().setFromObject(group);
          const center2 = box2.getCenter(new THREE.Vector3());
          group.position.sub(center2);
          group.position.y += 0.1;
        }
      },
      undefined,
      () => {
        const fallbackLoader = new GLTFLoader();
        fallbackLoader.load(
          "/ventilator.glb",
          (gltf) => {
            if (gltf?.scene) {
              group.clear();
              const model = gltf.scene;
              model.traverse((node) => {
                if (node.isMesh) {
                  node.castShadow = true;
                  node.receiveShadow = true;
                }
              });
              model.scale.set(1.2, 1.2, 1.2);
              group.add(model);
              const box2 = new THREE.Box3().setFromObject(group);
              const center2 = box2.getCenter(new THREE.Vector3());
              group.position.sub(center2);
              group.position.y += 0.1;
            }
          },
          undefined,
          () => {
            // fallback to the procedural model when neither DAE nor GLB are available
          }
        );
      }
    );

    let raf = null;
    const clock = new THREE.Clock();
    function animate() {
      raf = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      if (modelRef.current.group) {
        modelRef.current.group.rotation.y = elapsed * 0.12;
      }
      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || 360;
      const h = 300;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const { screen, knobs } = modelRef.current;
    if (!screen || !knobs.length) return;

    const spo2 = Number(latest?.SpO2 ?? 95);
    const peep = Number(recommendation?.proposed?.PEEP ?? 10);
    const fio2 = Number(recommendation?.proposed?.FiO2 ?? 50);
    const tv = Number(recommendation?.proposed?.TidalVol ?? 450);

    if (spo2 < 90) {
      screen.material.emissive.setHex(0xef4444);
      screen.material.emissiveIntensity = 0.8;
    } else if (spo2 < 94) {
      screen.material.emissive.setHex(0xf59e0b);
      screen.material.emissiveIntensity = 0.7;
    } else {
      screen.material.emissive.setHex(0x1e40af);
      screen.material.emissiveIntensity = 0.5;
    }

    knobs[0].rotation.y = (peep / 24) * Math.PI * 1.6;
    knobs[1].rotation.y = ((fio2 - 21) / 79) * Math.PI * 1.6;
    knobs[2].rotation.y = ((tv - 200) / 600) * Math.PI * 1.6;
  }, [latest, recommendation]);

  return (
    <div className="panel threeDPanel">
      <div className="panelHead"><h2>3D Model</h2></div>
      <div ref={mountRef} style={{ width: "100%", height: 300 }} />
    </div>
  );
}

function TestLabPage() {
  const scenarios = useAsync(api.scenarios, []);
  const [group, setGroup] = useState("control");
  const results = scenarios.data?.results || {};
  const groups = Object.keys(results);
  useEffect(() => {
    if (!results[group] && groups.length) setGroup(groups[0]);
  }, [scenarios.data]);
  const all = groups.flatMap((g) => results[g].map((item) => ({ group: g, ...item })));
  const selected = results[group] || [];
  const controlCases = results.control || [];
  const infectionCases = results.health_status || [];
  const historyLengthCases = results.lstm_history_length || [];
  const selectedSummaryRows = selected.map((item) => ({
    scenario: item.scenario_name,
    spo2: fmt(item.pred_spo2),
    hypoxia: pct(item.hypoxia_prob),
    hr: fmt(item.predicted_vitals?.Next_HR, 0),
    map: fmt(item.predicted_vitals?.Next_MAP, 0),
    resp: fmt(item.predicted_vitals?.Next_RespRate, 0),
    tv: fmt(item.predicted_vitals?.Next_TidalVol, 0),
  }));
  const healthStatusRows = controlCases.concat(infectionCases).map((item) => ({
    scenario: item.scenario_name,
    spo2: fmt(item.pred_spo2),
    hypoxia: pct(item.hypoxia_prob),
    hr: fmt(item.predicted_vitals?.Next_HR, 0),
    map: fmt(item.predicted_vitals?.Next_MAP, 0),
    resp: fmt(item.predicted_vitals?.Next_RespRate, 0),
    tv: fmt(item.predicted_vitals?.Next_TidalVol, 0),
  }));
  const historyLengthRows = historyLengthCases.map((item) => ({
    window: `${item.history_length} values`,
    spo2: fmt(item.pred_spo2),
    hypoxia: pct(item.hypoxia_prob),
    hr: fmt(item.predicted_vitals?.Next_HR, 0),
    map: fmt(item.predicted_vitals?.Next_MAP, 0),
    resp: fmt(item.predicted_vitals?.Next_RespRate, 0),
    tv: fmt(item.predicted_vitals?.Next_TidalVol, 0),
  }));
  const chartData = selected.map((item) => ({
    name: item.scenario_name.replace("Weather Impact: ", "").replace("Anomaly: ", ""),
    hypoxia: Number(item.hypoxia_prob) * 100,
    spo2: Number(item.pred_spo2),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Scenario laboratory"
        title="Professional LSTM Test Suite"
        description="Compare every demo scenario with all predicted vitals, all risk heads, and traceable findings."
        actions={<Button onClick={scenarios.reload}><RefreshCw size={16} /> Run Again</Button>}
      />
      {scenarios.loading ? <LoadingBlock label="Running scenarios" /> : scenarios.error ? <Empty icon={AlertTriangle} title="Scenario API failed" text={scenarios.error.message} /> : (
        <>
          <section className="grid four">
            <Metric label="Cases" value={all.length} note="Total scenarios" />
            <Metric label="Critical" value={all.filter((x) => x.alert_level === "CRITICAL").length} tone="danger" />
            <Metric label="Warning" value={all.filter((x) => x.alert_level === "WARNING").length} tone="warning" />
            <Metric label="Mean Risk" value={pct(all.reduce((s, x) => s + Number(x.hypoxia_prob), 0) / Math.max(all.length, 1))} />
          </section>
          <section className="grid two">
            <div className="panel">
              <h2>Healthy vs Lung Infection</h2>
              <div className="table">
                <div><span>Scenario</span><strong>SpO2 / Hypoxia / HR / MAP / RR / TV</strong></div>
                {healthStatusRows.map((row) => (
                  <div key={row.scenario}>
                    <span>{row.scenario}</span>
                    <strong>{row.spo2}% / {row.hypoxia} / {row.hr} / {row.map} / {row.resp} / {row.tv}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <h2>LSTM Window Sizes</h2>
              <div className="table">
                <div><span>History length</span><strong>SpO2 / Hypoxia / HR / MAP / RR / TV</strong></div>
                {historyLengthRows.map((row) => (
                  <div key={row.window}>
                    <span>{row.window}</span>
                    <strong>{row.spo2}% / {row.hypoxia} / {row.hr} / {row.map} / {row.resp} / {row.tv}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="panel xl">
            <div className="panelHead"><h2>Selected Group Metrics</h2><span>Numerical metrics for the active scenario group</span></div>
            <div className="dataGridTable">
              <div className="tableHeader">
                <span>Scenario</span>
                <span>SpO2</span>
                <span>Hypoxia</span>
                <span>HR</span>
                <span>MAP</span>
                <span>RR</span>
                <span>TV</span>
              </div>
              {selectedSummaryRows.map((row) => (
                <div key={row.scenario} className="tableRow">
                  <span>{row.scenario}</span>
                  <span>{row.spo2}%</span>
                  <span>{row.hypoxia}</span>
                  <span>{row.hr}</span>
                  <span>{row.map}</span>
                  <span>{row.resp}</span>
                  <span>{row.tv}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="split">
            <div className="panel">
              <h2>Scenario Groups</h2>
              <div className="groupList">
                {groups.map((g) => <button key={g} className={group === g ? "active" : ""} onClick={() => setGroup(g)}>{g.replaceAll("_", " ")}<span>{results[g].length}</span></button>)}
              </div>
            </div>
            <div className="panel xl">
              <div className="panelHead"><h2>{group.replaceAll("_", " ")}</h2><span>Graphs & trends</span></div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid stroke="rgba(148,163,184,.16)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(148,163,184,.25)", borderRadius: 8 }} />
                  <Bar dataKey="spo2" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="hypoxia" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel xl">
            <div className="panelHead">
              <h2>Trend view</h2>
              <span>Line graph for the same selected group</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(148,163,184,.16)" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(148,163,184,.25)", borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="spo2" stroke="#38bdf8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="hypoxia" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </section>
          <section className="scenarioGrid">
            {selected.map((item) => <ScenarioCard key={item.scenario_name} item={item} />)}
          </section>
        </>
      )}
    </>
  );
}

function ScenarioCard({ item }) {
  return (
    <article className="panel scenario">
      <div className="panelHead">
        <h2>{item.scenario_name}</h2>
        <span className={`chip ${alertTone(item.alert_level)}`}>{item.alert_level}</span>
      </div>
      <div className="grid three compact">
        <Metric label="Pred SpO2" value={`${fmt(item.pred_spo2)}%`} />
        <Metric label="Hypoxia" value={pct(item.hypoxia_prob)} tone={riskTone(item.hypoxia_prob)} />
        <Metric label="Samples" value={item.observations} />
      </div>
      <div className="dualTables">
        <MiniTable title="All Predicted Vitals" rows={item.predicted_vitals} />
        <RiskTable rows={item.risk_predictions} />
      </div>
      <ul>
        {(item.key_findings || []).map((f) => <li key={f}>{f}</li>)}
      </ul>
    </article>
  );
}

function MiniTable({ title, rows }) {
  return (
    <div>
      <h3>{title}</h3>
      <div className="table">
        {Object.entries(rows || {}).map(([k, v]) => <div key={k}><span>{k.replaceAll("_", " ")}</span><strong>{fmt(v)}</strong></div>)}
      </div>
    </div>
  );
}

function RiskTable({ rows }) {
  return (
    <div>
      <h3>All Risk Heads</h3>
      <div className="riskList small">
        {Object.entries(rows || {}).map(([k, v]) => (
          <div key={k}>
            <span>{k.replaceAll("_", " ")}</span>
            <strong className={v.risk ? "danger" : "good"}>{pct(v.probability)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelMetricsPage() {
  const evaluation = useAsync(api.evaluation, []);
  const reports = evaluation.data?.reports || {};
  const dual = reports.lstm_dual_head || {};
  const multi = reports.multi_risk_lstm || {};
  
  const regressionTargets = ["Next_SpO2", "Next_HR", "Next_MAP", "Next_RespRate", "Next_TidalVol"];
  const riskTargets = ["Hypoxia_Risk", "Tachycardia_Risk", "Hypotension_Risk", "Tachypnea_Risk", "VILI_Risk", "Shock_Risk"];
  
  const riskChart = riskTargets.map((name) => ({
    name: name.replace("_Risk", ""),
    AUROC: Number(multi[`${name}_auroc`] || 0),
    F1: Number(multi[`${name}_f1_optimal`] || 0),
  }));

  const regressionChart = regressionTargets.map((name) => ({
    name: name.replace("Next_", ""),
    MAE: Number(multi[`${name}_mae`] || 0),
    RMSE: Number(multi[`${name}_rmse`] || 0),
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: '#111827', border: '1px solid rgba(148,163,184,.25)', padding: '12px', borderRadius: '8px', color: '#fff' }}>
          <p style={{ margin: '0 0 8px', fontWeight: '600', color: '#f8fafc' }}>{label}</p>
          {payload.map(p => (
            <p key={p.dataKey} style={{ margin: '4px 0', fontSize: '13px', color: p.color || p.fill }}>
              {p.name}: <strong style={{ color: '#fff' }}>{p.value.toFixed(3)}</strong>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <PageHeader
        eyebrow="Evaluation center"
        title="Accuracy, Error & Classification Metrics"
        description="A focused view of the saved model reports: regression error for next vitals and classifier quality for each risk head."
        actions={<Button onClick={evaluation.reload}><RefreshCw size={16} /> Refresh</Button>}
      />
      
      {evaluation.loading ? <LoadingBlock label="Loading metrics" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <section className="grid four">
            <Metric label="Dual SpO2 MAE" value={fmt(dual.next_spo2_mae, 3)} />
            <Metric label="Dual SpO2 RMSE" value={fmt(dual.next_spo2_rmse, 3)} />
            <Metric label="Hypoxia AUROC" value={fmt(dual.hypoxia_auroc, 3)} tone="good" />
            <Metric label="VILI Best F1" value={fmt(multi.VILI_Risk_f1_optimal, 3)} tone="good" />
          </section>

          <section className="grid two">
            <div className="panel">
              <h2><Database size={18} style={{ verticalAlign: 'text-bottom', marginRight: '6px', color: '#38bdf8' }}/> Classification Quality (AUROC vs F1)</h2>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={riskChart}>
                  <PolarGrid stroke="rgba(148,163,184,.2)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 1]} tick={{ fill: '#475569', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Radar name="AUROC" dataKey="AUROC" stroke="#34d399" fill="#34d399" fillOpacity={0.4} />
                  <Radar name="F1 Score" dataKey="F1" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="panel">
              <h2><Activity size={18} style={{ verticalAlign: 'text-bottom', marginRight: '6px', color: '#fbbf24' }}/> Regression Error (MAE & RMSE)</h2>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={regressionChart} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid stroke="rgba(148,163,184,.16)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="MAE" fill="#34d399" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="RMSE" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="grid two">
            <div className="panel">
              <h2>Next Vital Regression Profile</h2>
              <div className="table">
                {regressionTargets.map((t) => (
                  <div key={t}>
                    <span>{t.replace("Next_", "")}</span>
                    <strong>MAE {fmt(multi[`${t}_mae`], 3)} <span style={{ color: '#475569', margin: '0 8px' }}>|</span> RMSE {fmt(multi[`${t}_rmse`], 3)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h2>Risk Threshold Configurations</h2>
              <div className="table">
                {riskTargets.map((t) => (
                  <div key={t}>
                    <span>{t.replace("_Risk", "")}</span>
                    <strong>AUROC {fmt(multi[`${t}_auroc`], 3)} <span style={{ color: '#475569', margin: '0 8px' }}>|</span> Opt. Thresh {fmt(multi[`${t}_optimal_threshold`], 2)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid one">
            <div className="panel">
              <h2>Dual-Head Baseline Reference</h2>
              <div className="table" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', background: 'transparent' }}>
                <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Hypoxia AUROC</span>
                  <strong style={{ fontSize: '18px', color: '#34d399' }}>{fmt(dual.hypoxia_auroc, 4)}</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Average Precision</span>
                  <strong style={{ fontSize: '18px', color: '#38bdf8' }}>{fmt(dual.hypoxia_avg_prec, 4)}</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>F1 @ 0.5 Threshold</span>
                  <strong style={{ fontSize: '18px', color: '#a78bfa' }}>{fmt(dual.hypoxia_f1_thresh05, 4)}</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Next SpO2 MAE</span>
                  <strong style={{ fontSize: '18px', color: '#fbbf24' }}>{fmt(dual.next_spo2_mae, 4)}</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Next SpO2 RMSE</span>
                  <strong style={{ fontSize: '18px', color: '#f87171' }}>{fmt(dual.next_spo2_rmse, 4)}</strong>
                </div>
              </div>
            </div>
          </section>

        </div>
      )}
    </>
  );
}

function AuditPage() {
  const audit = useAsync(async () => {
    const [verify, health, fiware, feed] = await Promise.all([
      api.auditVerify(),
      api.health(),
      api.fiware().catch(() => ({ enabled: false, health: { reachable: false } })),
      api.auditFeed().catch(() => ({ trail: [] }))
    ]);
    return { verify, health, fiware, feed };
  }, []);
  const data = audit.data || {};

  return (
    <>
      <PageHeader
        eyebrow="Trust and operations"
        title="Audit Chain & System Health"
        description="Verify the immutable audit trail, inspect dataset status, and confirm whether model artifacts are loaded."
        actions={<Button onClick={audit.reload}><RefreshCw size={16} /> Refresh</Button>}
      />
      {audit.loading ? <LoadingBlock label="Checking system" /> : (
        <>
          <section className="grid four">
            <Metric label="Audit Chain" value={data.verify?.valid ? "Valid" : "Invalid"} tone={data.verify?.valid ? "good" : "danger"} note={data.verify?.message} />
            <Metric label="Dataset" value={data.health?.dataset_index_loaded ? "Loaded" : "Simulator"} note={`${data.health?.index_rows || 0} rows`} />
            <Metric label="LSTM Artifacts" value={data.health?.lstm?.artifacts_found ? "Found" : "Missing"} tone={data.health?.lstm?.artifacts_found ? "good" : "warning"} />
            <Metric label="FIWARE" value={data.fiware?.enabled ? "Enabled" : "Off"} note={data.fiware?.base_url || "local mode"} />
          </section>
          <section className="grid two">
            <JsonPanel title="Audit Verification" data={data.verify} icon={Link2} />
            <JsonPanel title="API Health" data={data.health} icon={Server} />
          </section>
          
          <h2 style={{ marginTop: '32px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link2 size={18} /> Live Blockchain Audit Feed
          </h2>
          <div className="panel" style={{ maxHeight: '500px', overflowY: 'auto', background: '#0a101d', border: '1px solid #1e293b' }}>
            {data.feed?.trail?.length > 0 ? (
              data.feed.trail.map((block, i) => (
                <div key={i} style={{ padding: '12px', borderBottom: '1px solid #1e293b', fontFamily: 'monospace' }}>
                  <div style={{ color: '#38bdf8', fontWeight: 'bold', marginBottom: '4px' }}>
                    [BLOCK #{block.block_id}] {block.event_type} — {new Date(block.timestamp).toLocaleString()}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '8px' }}>
                    Chain Hash: {block.chain_hash}
                    <br/>
                    Payload Hash: {block.payload_hash}
                  </div>
                  <pre style={{ margin: 0, padding: '8px', background: '#0f172a', borderRadius: '4px', color: '#e2e8f0', fontSize: '11px', overflowX: 'auto' }}>
                    {block.payload_json}
                  </pre>
                </div>
              ))
            ) : (
              <div style={{ padding: '24px', color: '#64748b' }}>No blocks found or syncing...</div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function JsonPanel({ title, data, icon: Icon }) {
  return (
    <div className="panel">
      <div className="panelHead"><h2>{title}</h2><Icon size={18} /></div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
