import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Shield,
  TestTube2,
  Wind,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import VentilatorScene from "./components/VentilatorScene.jsx";
import { api } from "./api";

const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "--" : Number(v).toFixed(d));
const pct = (v, d = 1) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "--" : `${(Number(v) * 100).toFixed(d)}%`);

const PIPELINE = [
  { title: "Telemetry", detail: "ICU ventilator + patient vitals stream", tone: "blue" },
  { title: "LSTM Forecast", detail: "SpO₂ regression & hypoxia risk", tone: "cyan" },
  { title: "PPO Policy", detail: "Safe PEEP / FiO₂ / TV recommendations", tone: "green" },
  { title: "Digital Twin", detail: "Physics simulation & what-if replay", tone: "purple" },
  { title: "Blockchain Audit", detail: "Immutable recommendation ledger", tone: "amber" },
];

export default function DigitalTwinPage({ selected, PageHeader, Button, Metric, Empty, LoadingBlock }) {
  const [history, setHistory] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [replay, setReplay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [runningReplay, setRunningReplay] = useState(false);
  const [modelStatus, setModelStatus] = useState("Loading 3D asset…");

  const load = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const hist = await api.history(selected);
      const rows = hist.history || [];
      setHistory(rows);
      const latest = rows[rows.length - 1];
      if (latest && rows.length >= 8) {
        const rec = await api.recommend(selected, { ...latest, history: rows.slice(-64) });
        setRecommendation(rec);
      } else {
        setRecommendation(null);
      }
    } catch (error) {
      console.warn("Digital twin page load failed", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selected]);

  const latest = history[history.length - 1] || {};
  const twin = recommendation?.twin_simulation || {};
  const proposed = recommendation?.proposed || {};

  const twinChart = useMemo(
    () => (twin.trajectory || []).map((v, i) => ({ step: i === 0 ? "Now" : `+${i * 15}m`, SpO2: Number(v) })),
    [twin.trajectory],
  );

  const runReplay = async () => {
    if (!history.length || !proposed.PEEP) return;
    setRunningReplay(true);
    try {
      const data = await api.twinReplay({
        stay_id: Number(selected),
        history: history.slice(-32),
        current_spo2: latest.SpO2,
        proposed,
        steps: 8,
        noise_scale: 0,
      });
      setReplay(data.result);
    } finally {
      setRunningReplay(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="3D digital twin workspace"
        title="Ventilator Digital Twin Dashboard"
        description="Visualize the medical-ventilator 3D asset, run physics-based what-if simulation, and align twin output with LSTM forecasts, PPO recommendations, and blockchain audit events."
        actions={
          <Button onClick={load} disabled={loading || !selected}>
            <RefreshCw size={16} /> Sync Twin
          </Button>
        }
      />

      <section className="twinPipeline">
        {PIPELINE.map((step, index) => (
          <div key={step.title} className="twinPipelineStep">
            <div className={`twinPipelineCard ${step.tone}`}>
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </div>
            {index < PIPELINE.length - 1 ? <ArrowRight size={16} className="twinPipelineArrow" /> : null}
          </div>
        ))}
      </section>

      {loading ? <LoadingBlock label="Syncing patient twin state" /> : (
        <section className="twinWorkspace">
          <div className="panel twinScenePanel">
            <div className="panelHead">
              <h2><Box size={18} /> Medical Ventilator Model</h2>
              <span>{modelStatus}</span>
            </div>
            <VentilatorScene
              alertLevel={recommendation?.alert_level || "STABLE"}
              spo2={Number(latest.SpO2 ?? twin.trajectory?.[0] ?? 95)}
              respRate={Number(latest.RespRate ?? 12)}
              peep={Number(proposed.PEEP ?? latest.PEEP ?? 5)}
              fio2={Number(proposed.FiO2 ?? latest.FiO2 ?? 40)}
              tidalVol={Number(proposed.TidalVol ?? latest.TidalVol ?? 450)}
              pressure={Number(latest.MAP ? latest.MAP * 0.15 : 15)}
              onStatusChange={setModelStatus}
            />
          </div>

          <aside className="twinSideStack">
            <div className="panel">
              <div className="panelHead"><h2>Live Telemetry</h2><span>Patient {selected || "--"}</span></div>
              <div className="grid two compact">
                <Metric label="SpO₂" value={latest.SpO2 !== undefined && latest.SpO2 !== null ? `${fmt(latest.SpO2)}%` : "--"} tone={latest.SpO2 !== undefined && latest.SpO2 !== null ? (Number(latest.SpO2) < 92 ? "danger" : "good") : ""} />
                <Metric label="HR" value={fmt(latest.HR, 0)} />
                <Metric label="MAP" value={fmt(latest.MAP, 0)} />
                <Metric label="Resp Rate" value={fmt(latest.RespRate, 0)} />
              </div>
              <div className="settingRows">
                <div className="row"><span>PEEP (observed)</span><strong>{fmt(latest.PEEP)} cmH₂O</strong></div>
                <div className="row"><span>FiO₂ (observed)</span><strong>{fmt(latest.FiO2)}%</strong></div>
                <div className="row"><span>Tidal Vol</span><strong>{fmt(latest.TidalVol, 0)} mL</strong></div>
              </div>
            </div>

            <div className="panel twinHighlight">
              <div className="panelHead"><h2>Twin Simulation</h2><span>services/digital_twin.py</span></div>
              {!recommendation ? (
                <Empty icon={Wind} title="Awaiting co-pilot" text="Load a patient with enough history to run /recommend and attach twin_simulation." />
              ) : (
                <>
                  <div className="grid three compact">
                    <Metric label="Mean SpO₂" value={`${fmt(twin.mean_spo2)}%`} />
                    <Metric label="Δ SpO₂" value={fmt(twin.delta_spo2)} tone={twin.delta_spo2 !== undefined && twin.delta_spo2 !== null ? (Number(twin.delta_spo2) < 0 ? "danger" : "good") : ""} />
                    <Metric label="Uncertainty" value={`±${fmt(twin.uncertainty)}`} />
                  </div>
                  <div className="twinFlags">
                    <span className={twin.risk_flag ? "flag danger" : "flag good"}>
                      Hypoxia risk {twin.risk_flag ? "elevated" : "low"}
                    </span>
                    <span className={twin.tv_risk ? "flag warning" : "flag good"}>
                      VILI / TV {twin.tv_risk ? "watch" : "ok"}
                    </span>
                  </div>
                  <p className="hint">
                    Twin maps PEEP, FiO₂, and tidal volume to a projected SpO₂ trajectory used on the main dashboard chart.
                  </p>
                </>
              )}
            </div>

            <div className="panel">
              <div className="panelHead"><h2>PPO Recommendation</h2><span>RL + safety guards</span></div>
              {!recommendation ? (
                <Empty icon={Activity} title="No proposal" text="Recommendations appear after the API analyzes recent history." />
              ) : (
                <>
                  <div className="grid three compact">
                    <Metric label="PEEP" value={fmt(proposed.PEEP)} note={`Δ ${fmt(recommendation.delta?.PEEP)}`} />
                    <Metric label="FiO₂" value={`${fmt(proposed.FiO2)}%`} note={`Δ ${fmt(recommendation.delta?.FiO2)}`} />
                    <Metric label="Tidal Vol" value={`${fmt(proposed.TidalVol, 0)}`} note={`Δ ${fmt(recommendation.delta?.TidalVol, 0)}`} />
                  </div>
                  <div className="row"><span>LSTM next SpO₂</span><strong>{fmt(recommendation.pred_next_spo2)}%</strong></div>
                  <div className="row"><span>Hypoxia prob</span><strong>{pct(recommendation.hypoxia_prob)}</strong></div>
                  <div className="row"><span>Confidence</span><strong>{pct(recommendation.confidence)}</strong></div>
                  <p className="hint">{recommendation.rationale || "—"}</p>
                  {(recommendation.safety_flags || []).length > 0 ? (
                    <ul className="safetyList">
                      {recommendation.safety_flags.map((flag) => (
                        <li key={flag}><AlertTriangle size={14} /> {flag}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hint good"><CheckCircle2 size={14} /> No active safety flags</p>
                  )}
                </>
              )}
            </div>
          </aside>
        </section>
      )}

      <section className="grid two">
        <div className="panel">
          <div className="panelHead">
            <h2>Projected Twin Trajectory</h2>
            <span>From latest /recommend</span>
          </div>
          {twinChart.length < 2 ? (
            <Empty icon={Wind} title="No twin trajectory" text="Run Sync Twin after the co-pilot returns twin_simulation." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={twinChart}>
                <CartesianGrid stroke="rgba(148,163,184,.14)" vertical={false} />
                <XAxis dataKey="step" stroke="#94a3b8" />
                <YAxis domain={[88, 100]} stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(148,163,184,.25)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="SpO2" stroke="#a855f7" strokeWidth={2.5} strokeDasharray="6 5" dot={{ r: 4, fill: "#a855f7" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel">
          <div className="panelHead">
            <h2>Deterministic Replay</h2>
            <Button onClick={runReplay} disabled={runningReplay || !recommendation}>
              <TestTube2 size={16} /> Run /twin/replay
            </Button>
          </div>
          {!replay ? (
            <Empty icon={TestTube2} title="Replay ready" text="Simulate proposed settings inside the digital twin before accepting clinical changes." />
          ) : (
            <>
              <div className="grid three compact">
                <Metric label="Replay mean" value={`${fmt(replay.mean_spo2)}%`} />
                <Metric label="Replay Δ" value={fmt(replay.delta_spo2)} tone={Number(replay.delta_spo2) < 0 ? "danger" : "good"} />
                <Metric label="Applied PEEP" value={fmt(replay.applied?.PEEP)} />
              </div>
              <p className="hint">
                Replay uses the same twin engine as recommendations and is logged to the blockchain audit trail as a TWIN_SIM event.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="panel twinRelevance">
        <div className="panelHead"><h2><Shield size={18} /> Why this matters in the major project</h2></div>
        <div className="twinRelevanceGrid">
          <article>
            <h3>Clinical co-pilot loop</h3>
            <p>
              The twin is not decorative 3D—it validates PPO proposals by simulating how SpO₂ responds to ventilator changes before clinicians accept them on the live dashboard.
            </p>
          </article>
          <article>
            <h3>Asset source</h3>
            <p>
              The scene loads <code>medical-ventilator/source/Ventilator/model/Ventilator.dae</code> (served from <code>/model/Ventilator.dae</code> with PBR textures under <code>/Textures/</code>).
            </p>
          </article>
          <article>
            <h3>Traceability</h3>
            <p>
              Every recommendation and replay can be anchored in the audit ledger, linking model output, twin trajectory, and clinician accept/override actions for viva and demo review.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
