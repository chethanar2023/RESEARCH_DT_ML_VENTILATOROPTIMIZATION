import os
import re

file_path = r"c:\Users\shaik\Desktop\Major Project\frontend\app\src\FiwarePage.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update initial state
old_controls = """  const [controls, setControls] = useState({
    peep: 5.0,
    fio2: 40,
    volume: 450,
    respRate: 12,
    temp: 36.8,
    humidity: 60,
  });"""
new_controls = """  const [controls, setControls] = useState({
    peep: 5.0,
    fio2: 40,
    volume: 450,
    respRate: 12,
    temp: 36.8,
    humidity: 60,
    pressure: 1013,
  });"""
code = code.replace(old_controls, new_controls)

old_livestate = """  const [liveState, setLiveState] = useState({
    spo2: 97,
    pressure: 15,
    risk: 2,
    hr: 75,
    status: "STABLE",
  });"""
new_livestate = """  const [liveState, setLiveState] = useState({
    spo2: 97,
    pressure: 15,
    hr: 75,
    map: 70,
    resp: 15,
    status: "STABLE",
    risks: {
      Hypoxia: 0,
      Tachycardia: 0,
      Hypotension: 0,
      Tachypnea: 0,
      VILI: 0,
    }
  });"""
code = code.replace(old_livestate, new_livestate)

# 2. Replace the useEffect math simulator
old_effect = """  // Live Data Simulation influenced by controls
  useEffect(() => {
    let t = 0;
    const interval = setInterval(() => {
      t += 1;
      setLiveState(prev => {
        // Base physics influenced by sliders
        const pBase = controls.peep + (controls.volume / 50);
        const p = pBase + Math.sin(t * 0.5) * 2 + Math.random() * 1;
        
        const sBase = 90 + (controls.fio2 / 10) + (controls.peep / 5);
        const s = Math.min(100, sBase + Math.sin(t * 0.2) * 1 + Math.random() * 0.5);
        
        const r = Math.max(1, 100 - s + (p > 28 ? (p - 28) * 2 : 0));
        
        const newState = {
          ...prev,
          pressure: p,
          spo2: s,
          risk: r,
          hr: 70 + (controls.respRate / 2) + Math.sin(t) * 2,
          status: s < 92 || p > 30 ? "CRITICAL" : (s < 94 ? "WARNING" : "STABLE")
        };

        setDataHistory(hist => {
          const updated = [...hist, { time: t, spo2: s, pressure: p, risk: r }];
          return updated.length > 50 ? updated.slice(1) : updated;
        });

        return newState;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [controls]);"""

new_effect = """  // Live ML Integration
  useEffect(() => {
    let active = true;
    const fetchPrediction = async () => {
      try {
        const payload = {
          stay_id: 999000,
          steps: 4,
          noise_scale: 0.1,
          proposed: {
            PEEP: controls.peep,
            FiO2: controls.fio2,
            TidalVol: controls.volume,
            RespRate: controls.respRate
          },
          weather: {
            temperature_c: controls.temp,
            humidity_pct: controls.humidity,
            pressure_hpa: controls.pressure
          }
        };
        const twinRes = await api.twinReplay(payload);
        if (!active || !twinRes.result?.trajectory) return;
        const traj = twinRes.result.trajectory;
        
        // Feed trajectory to risk API
        const riskRes = await api.risks(999000, traj);
        if (!active || !riskRes.risk_predictions) return;

        // Update live state
        const last = traj[traj.length - 1];
        const r = riskRes.risk_predictions;
        
        const isCritical = r.Hypoxia_Risk > 0.7 || r.VILI_Risk > 0.7;
        const isWarning = r.Hypoxia_Risk > 0.4 || r.VILI_Risk > 0.4;
        
        setLiveState(prev => ({
          ...prev,
          spo2: last.SpO2 || 97,
          pressure: last.PEEP + (last.TidalVol/50) || 15,
          hr: last.HR || 75,
          map: last.MAP || 70,
          resp: last.RespRate || 15,
          status: isCritical ? "CRITICAL" : (isWarning ? "WARNING" : "STABLE"),
          risks: {
            Hypoxia: r.Hypoxia_Risk || 0,
            Tachycardia: r.Tachycardia_Risk || 0,
            Hypotension: r.Hypotension_Risk || 0,
            Tachypnea: r.Tachypnea_Risk || 0,
            VILI: r.VILI_Risk || 0,
          }
        }));
        
        setDataHistory(hist => {
          const updated = [...hist, { time: Date.now(), spo2: last.SpO2, pressure: last.PEEP + (last.TidalVol/50) }];
          return updated.length > 50 ? updated.slice(-50) : updated;
        });
        
      } catch (err) {
        console.error("Twin Replay Error", err);
      }
    };

    const timer = setTimeout(fetchPrediction, 500); // 500ms debounce
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [controls]);"""

if old_effect in code:
    code = code.replace(old_effect, new_effect)
else:
    print("Could not find old_effect")

# 3. Add Pressure slider
old_temp_slider = """                <div className="control-group">
                  <div className="control-header">
                    <span>Temperature</span>
                    <strong>{controls.temp.toFixed(1)} °C</strong>
                  </div>
                  <input type="range" min="15" max="40" step="0.1" value={controls.temp} onChange={e => handleControlChange('temp', e.target.value)} />
                </div>"""

new_pressure_slider = old_temp_slider + """

                <div className="control-group">
                  <div className="control-header">
                    <span>Pressure (hPa)</span>
                    <strong>{controls.pressure} hPa</strong>
                  </div>
                  <input type="range" min="700" max="1100" step="10" value={controls.pressure} onChange={e => handleControlChange('pressure', e.target.value)} />
                </div>"""

if old_temp_slider in code:
    code = code.replace(old_temp_slider, new_pressure_slider)
else:
    print("Could not find temp slider")


# 4. Replace left rail risk display
old_risk_display = """            <div className="fiware-glass-card">
              <h3><ShieldCheck size={16} /> Defect Risk</h3>
              <div className="risk-display" style={{ color: getStatusColor(liveState.status) }}>
                {liveState.risk.toFixed(1)}%
              </div>
              <div className="risk-bar-container">
                <div className="risk-bar" style={{ width: `${Math.min(100, liveState.risk * 3)}%`, backgroundColor: getStatusColor(liveState.status) }}></div>
              </div>
            </div>"""

new_risk_display = """            <div className="fiware-glass-card">
              <h3><ShieldCheck size={16} /> Multi-Risk Matrix</h3>
              {Object.entries(liveState.risks).map(([name, riskVal]) => (
                <div key={name} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#88a3b8', marginBottom: '4px' }}>
                    <span>{name}</span>
                    <span>{(riskVal * 100).toFixed(1)}%</span>
                  </div>
                  <div className="risk-bar-container">
                    <div className="risk-bar" style={{ width: `${Math.min(100, riskVal * 100)}%`, backgroundColor: riskVal > 0.7 ? 'var(--fiware-danger)' : (riskVal > 0.4 ? 'var(--fiware-warning)' : 'var(--fiware-primary)') }}></div>
                  </div>
                </div>
              ))}
            </div>"""

if old_risk_display in code:
    code = code.replace(old_risk_display, new_risk_display)
else:
    print("Could not find left rail risk display")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(code)

print("Finished rewriting FiwarePage.jsx")
