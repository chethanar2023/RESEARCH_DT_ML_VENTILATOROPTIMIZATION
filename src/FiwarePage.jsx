import React, { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Cpu, Radio, ShieldCheck, Thermometer, Wind, Play, RotateCcw, Sliders } from "lucide-react";
import { LineChart, Line, YAxis, ResponsiveContainer } from "recharts";
import * as THREE from "three";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { api, API_BASE } from "./api";

export default function FiwarePage() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [dataHistory, setDataHistory] = useState([]);
  
  // Interactive control state
  const [controls, setControls] = useState({
    peep: 5.0,
    fio2: 40,
    volume: 450,
    respRate: 12,
    temp: 36.8,
    humidity: 60,
    atmPressure: 1013,
  });

  const [liveState, setLiveState] = useState({
    spo2: 97,
    pressure: 15,
    risk: 2,
    hr: 75,
    status: "STABLE",
    risks: {
      hypoxia: 0,
      tachycardia: 0,
      hypotension: 0,
      tachypnea: 0,
      vili: 0,
      shock: 0
    }
  });

  const [auditTrail, setAuditTrail] = useState([]);
  
  const addLog = async (msg, actionType, settings) => {
    // Send to blockchain audit ledger instead of local state
    try {
      await fetch(`${API_BASE}/patient/999000/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionType, notes: msg, settings })
      });
      fetchAuditFeed();
    } catch (e) {
      console.error("Failed to post audit", e);
    }
  };

  const fetchAuditFeed = async () => {
    try {
      const res = await fetch(`${API_BASE}/audit/feed`);
      if (res.ok) {
        const data = await res.json();
        if (data.trail) setAuditTrail(data.trail);
      }
    } catch (e) {
      console.error("Failed to fetch audit feed", e);
    }
  };

  useEffect(() => {
    fetchAuditFeed();
    const interval = setInterval(fetchAuditFeed, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleVerifyLedger = async () => {
    try {
      const res = await fetch(`${API_BASE}/audit/verify`);
      if (res.ok) {
        const data = await res.json();
        if (data.valid) {
          alert(`VERIFIED SUCCESS: ${data.message}\nTotal Blocks: ${data.stats.total_blocks}`);
        } else {
          alert(`TAMPER ALERT: ${data.message}`);
        }
      }
    } catch (e) {
      alert("Failed to reach verification node.");
    }
  };

  // 3D Scene Setup with Collada Model
  useEffect(() => {
    if (!mountRef.current) return;
    
    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;
    
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000);
    camera.position.set(3, 2.5, 5);
    camera.lookAt(0, -0.2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    const controls3d = new OrbitControls(camera, renderer.domElement);
    controls3d.enableDamping = true;
    controls3d.dampingFactor = 0.05;
    controls3d.enableZoom = true; // Re-enable scroll zoom
    controls3d.minDistance = 2;
    controls3d.maxDistance = 12;
    controls3d.autoRotate = true;
    controls3d.autoRotateSpeed = 1.0;

    // No Background
    scene.background = null;

    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x444455, 1.2);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(4, 7, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x00f0ff, 0.8);
    fillLight.position.set(-4, 3, -5);
    scene.add(fillLight);

    const gridHelper = new THREE.GridHelper(20, 40, 0x475569, 0x1e293b);
    gridHelper.position.y = -1.2;
    gridHelper.material.opacity = 0.3;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // Lungs inside a frame
    const lungsContainer = new THREE.Group();
    lungsContainer.position.set(-1.5, 0.8, 0);
    scene.add(lungsContainer);
    window.__ventLungsContainer = lungsContainer;

    const lungsGroup = new THREE.Group();
    lungsContainer.add(lungsGroup);
    
    // Add a glowing frame around the lungs
    const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.8, 1.8));
    const frameMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 });
    const frame = new THREE.LineSegments(frameGeo, frameMat);
    lungsContainer.add(frame);

    const lungTexLoader = new THREE.TextureLoader();
    lungTexLoader.load('/lung_texture.png', (lungTex) => {
      lungTex.colorSpace = THREE.SRGBColorSpace;
      const lungGeo = new THREE.PlaneGeometry(1.6, 1.6, 16, 16);
      const lungMat = new THREE.MeshBasicMaterial({ 
        map: lungTex, 
        transparent: true, 
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      let lungPlane = new THREE.Mesh(lungGeo, lungMat);
      lungsGroup.add(lungPlane);
      window.__ventLungMat = lungMat;
    });

    // Canvas Screen Texture
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 512;
    screenCanvas.height = 256;
    const screenCtx = screenCanvas.getContext('2d');
    const screenTex = new THREE.CanvasTexture(screenCanvas);
    screenTex.colorSpace = THREE.SRGBColorSpace;
    window.__ventScreenCtx = screenCtx;
    window.__ventScreenTex = screenTex;

    // Load Medical Ventilator Collada Model
    const loader = new ColladaLoader();
    let daeModel = null;
    // lungL, lungR are already declared above

    loader.load(
      "/model/Ventilator.dae",
      (collada) => {
        daeModel = collada.scene;
        
        // Assign realistic medical colors
        daeModel.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            
            let mColor = 0xffffff; // bright glossy white
            let mRough = 0.1;
            let mMetal = 0.3;
            let mTrans = false;
            let mOpac = 1.0;
            
            const n = (node.name || "").toLowerCase();
            if (n.includes("screen") || n.includes("display") || n.includes("monitor")) {
               node.material = new THREE.MeshBasicMaterial({ map: screenTex });
               return; // skip standard material
            } else if (n.includes("tube") || n.includes("hose") || n.includes("pipe") || n.includes("bellow")) {
               mColor = 0x00f0ff; // vibrant cyan
               mTrans = true;
               mOpac = 0.6;
               mRough = 0.0;
            } else if (n.includes("stand") || n.includes("base") || n.includes("wheel") || n.includes("metal")) {
               mColor = 0xb0c4de; // bright steel
               mMetal = 1.0;
               mRough = 0.2;
            } else if (n.includes("button") || n.includes("dial")) {
               mColor = 0xff0055; // neon pink
               mMetal = 0.8;
               mRough = 0.1;
            }

            node.material = new THREE.MeshStandardMaterial({
              color: mColor,
              roughness: mRough,
              metalness: mMetal,
              transparent: mTrans,
              opacity: mOpac,
              side: THREE.DoubleSide
            });
          }
        });

        // Auto-scale and center the model
        const bounds = new THREE.Box3().setFromObject(daeModel);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        bounds.getSize(size);
        bounds.getCenter(center);
        const maxAxis = Math.max(size.x, size.y, size.z) || 1;
        
        daeModel.scale.setScalar(3.4 / maxAxis);
        daeModel.position.sub(center.multiplyScalar(3.4 / maxAxis));
        daeModel.position.y -= 0.9;
        
        // Fix orientation to make it upright
        daeModel.rotation.x = -Math.PI / 2; // Often needed for Collada models exported from Z-up environments
        daeModel.rotation.z = Math.PI / 4;  // Angle it slightly towards the camera
        
        modelGroup.add(daeModel);
        addLog("[SYSTEM] Loaded Medical Ventilator DAE Model");
      },
      undefined,
      (error) => {
        console.error("ColladaLoader error", error);
        addLog("[ERROR] Failed to load 3D model. Using placeholder.");
        
        // Fallback placeholder if DAE fails
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 1.5, 1),
          new THREE.MeshStandardMaterial({ color: 0x0a192f, emissive: 0x002244 })
        );
        base.position.y = -0.4;
        modelGroup.add(base);
      }
    );

    let animationFrameId;
    let phase = 0;
    
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      phase += 0.05;
      
      controls3d.update();

      // Make the lungs container always perfectly parallel to the camera sensor
      if (window.__ventLungsContainer) {
         window.__ventLungsContainer.quaternion.copy(camera.quaternion);
      }
      
      // Animate lungs
      if (lungsGroup && window.__ventRespRate) {
         const rr = window.__ventRespRate;
         const lungScale = 1 + Math.sin(Date.now() * 0.001 * (rr / 60) * Math.PI * 2) * 0.15;
         lungsGroup.scale.set(lungScale, lungScale, lungScale);
         
         const hypoxiaRisk = window.__ventHypoxia || 0;
         const viliRisk = window.__ventVili || 0;
         
         const targetColor = new THREE.Color(0xffffff);
         if (hypoxiaRisk > 50) targetColor.lerp(new THREE.Color(0x38bdf8), (hypoxiaRisk-50)/50);
         if (viliRisk > 50) targetColor.lerp(new THREE.Color(0xff0055), (viliRisk-50)/50);
         
         if (window.__ventLungMat) {
           window.__ventLungMat.color.lerp(targetColor, 0.05);
         }
      }
      
      renderer.render(scene, camera);
    };
    
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const nw = mountRef.current.clientWidth;
      const nh = mountRef.current.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      controls3d.dispose();
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Live Data Simulation influenced by controls
  useEffect(() => {
    let t = 0;
    const interval = setInterval(() => {
      t += 1;
      setLiveState(prev => {
        // Base physics influenced by sliders
        const pBase = controls.peep + (controls.volume / 50);
        const p = pBase + Math.sin(t * 0.5) * 2 + Math.random() * 1;
        
        // Weather physics from test cases
        const fio2Efficiency = controls.atmPressure / 1013.25;
        const effectiveFio2 = controls.fio2 * fio2Efficiency;
        const tempPenalty = controls.temp > 37.5 && controls.humidity > 80 ? 2 : 0;
        
        const sBase = 90 + (effectiveFio2 / 10) + (controls.peep / 5) - tempPenalty;
        const s = Math.min(100, sBase + Math.sin(t * 0.2) * 1 + Math.random() * 0.5);
        
        const hr = 70 + (controls.respRate / 2) + (100 - s) * 2 + Math.sin(t) * 2;
        const map = 65 + (p * 0.5) + Math.random() * 2;
        
        // Multi-risks
        const hypoxia = Math.max(0, (94 - s) / 10) * 100;
        const tachycardia = Math.max(0, (hr - 100) / 40) * 100;
        const hypotension = Math.max(0, (65 - map) / 20) * 100;
        const tachypnea = Math.max(0, (controls.respRate - 24) / 16) * 100;
        const vili = Math.max(0, (p - 30) / 10) * 100 + Math.max(0, (controls.volume - 600) / 200) * 100;
        
        const maxRisk = Math.max(hypoxia, tachycardia, hypotension, tachypnea, vili);
        const shock = (hypoxia > 50 && hypotension > 50) ? 90 : Math.min(100, maxRisk * 0.8);
        
        const avgRisk = (hypoxia + tachycardia + hypotension + tachypnea + vili + shock) / 6;
        
        window.__ventRespRate = controls.respRate;
        window.__ventHypoxia = hypoxia;
        window.__ventVili = vili;
        
        // Update 3D Canvas Screen
        if (window.__ventScreenCtx && window.__ventScreenTex) {
           const ctx = window.__ventScreenCtx;
           ctx.fillStyle = '#0f172a';
           ctx.fillRect(0, 0, 512, 256);
           
           ctx.fillStyle = s < 90 ? '#ef4444' : '#10b981';
           ctx.font = 'bold 64px Inter, sans-serif';
           ctx.fillText(`SpO2: ${s.toFixed(1)}%`, 30, 80);
           
           ctx.fillStyle = '#38bdf8';
           ctx.font = 'bold 48px Inter, sans-serif';
           ctx.fillText(`Peak: ${p.toFixed(1)} cmH2O`, 30, 150);
           
           ctx.fillStyle = '#9ca3af';
           ctx.font = '28px Inter, sans-serif';
           ctx.fillText(`HR: ${Math.round(hr)} bpm   |   Risk: ${avgRisk.toFixed(1)}%`, 30, 220);
           
           window.__ventScreenTex.needsUpdate = true;
        }

        const newState = {
          ...prev,
          pressure: p,
          spo2: s,
          risk: avgRisk,
          hr: hr,
          status: s < 90 || p > 35 || maxRisk > 80 ? "CRITICAL" : (s < 94 || maxRisk > 50 ? "WARNING" : "STABLE"),
          risks: {
            hypoxia: Math.min(100, hypoxia),
            tachycardia: Math.min(100, tachycardia),
            hypotension: Math.min(100, hypotension),
            tachypnea: Math.min(100, tachypnea),
            vili: Math.min(100, vili),
            shock: Math.min(100, shock)
          }
        };

        setDataHistory(hist => {
          const updated = [...hist, { time: t, spo2: s, pressure: p, risk: avgRisk }];
          return updated.length > 50 ? updated.slice(1) : updated;
        });

        return newState;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [controls]);

  const handleControlChange = (key, val) => {
    setControls(prev => ({ ...prev, [key]: Number(val) }));
    if (Math.random() > 0.8) {
      addLog(`Adjusted ${key} to ${val}`, "override", { [key]: Number(val) });
    }
  };

  const applyMode = (mode) => {
    if (mode === 'safety') {
      const settings = { peep: 8, fio2: 60, volume: 400, respRate: 15, atmPressure: 1013, temp: 37, humidity: 50 };
      setControls({ ...controls, ...settings });
      addLog(`Applied ${mode.toUpperCase()} preset`, "override", settings);
    }
    if (mode === 'balanced') {
      const settings = { peep: 5, fio2: 40, volume: 450, respRate: 12, atmPressure: 1013, temp: 36.8, humidity: 60 };
      setControls({ ...controls, ...settings });
      addLog(`Applied ${mode.toUpperCase()} preset`, "accept", settings);
    }
  };

  const getStatusColor = (status) => {
    if (status === "CRITICAL") return "var(--cy-danger)";
    if (status === "WARNING") return "var(--cy-warning)";
    return "var(--cy-success)";
  };

  return (
    <div className="fiware-twin-dashboard">
      {/* 3D Background */}
      <div className="fiware-3d-container" ref={mountRef}></div>

      {/* Glassmorphic Overlay UI */}
      <div className="fiware-ui-overlay">
        
        {/* Top Header */}
        <header className="fiware-header">
          <div className="fiware-title">
            <Cpu size={24} className="glow-icon" />
            <div>
              <h1>VENTILATOR // DIGITAL TWIN</h1>
              <span>SANDBOX & ORION BROKER ENABLED</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="fiware-action-btn primary" onClick={() => applyMode('balanced')}>
              <Play size={14} /> Start
            </button>
            <button className="fiware-action-btn danger" onClick={() => applyMode('safety')}>
              <RotateCcw size={14} /> Safety Mode
            </button>
            <div className="fiware-status-pill" style={{ borderColor: getStatusColor(liveState.status), color: getStatusColor(liveState.status), marginLeft: '12px' }}>
              <Radio size={16} className={liveState.status === "STABLE" ? "pulse-icon" : "pulse-icon-fast"} />
              {liveState.status}
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="fiware-grid">
          
          {/* Left Column: Live Metrics */}
          <aside className="fiware-rail left-rail">
            <div className="fiware-glass-card">
              <h3><Activity size={16} /> Patient State</h3>
              <div className="fiware-metric">
                <span className="label">SpO2</span>
                <span className="value" style={{ color: "var(--cy-success)" }}>{liveState.spo2.toFixed(1)}%</span>
              </div>
              <div className="fiware-metric">
                <span className="label">Heart Rate</span>
                <span className="value">{liveState.hr.toFixed(0)} bpm</span>
              </div>
            </div>

            <div className="fiware-glass-card">
              <h3><Wind size={16} /> Airway Pressure</h3>
              <div className="fiware-metric">
                <span className="label">Peak</span>
                <span className="value" style={{ color: "var(--cy-primary)" }}>{liveState.pressure.toFixed(1)} cmH2O</span>
              </div>
              <div className="fiware-metric">
                <span className="label">PEEP set</span>
                <span className="value">{controls.peep.toFixed(1)} cmH2O</span>
              </div>
            </div>

            <div className="fiware-glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0 }}><ShieldCheck size={16} /> Defect Risk</h3>
                <span className="risk-display" style={{ fontSize: '28px', margin: 0, color: liveState.risk > 80 ? 'var(--cy-danger)' : liveState.risk > 50 ? 'var(--cy-warning)' : 'var(--cy-success)' }}>
                  {liveState.risk.toFixed(1)}%
                </span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px' }}>
                {Object.entries(liveState.risks).map(([key, val]) => (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px', textTransform: 'capitalize' }}>
                      <span style={{ color: '#9ca3af' }}>{key}</span>
                      <span style={{ color: val > 80 ? 'var(--cy-danger)' : val > 50 ? 'var(--cy-warning)' : 'var(--cy-success)' }}>{val.toFixed(1)}%</span>
                    </div>
                    <div className="risk-bar-container" style={{ marginTop: '0', height: '4px', background: 'rgba(255,255,255,0.05)' }}>
                      <div className="risk-bar" style={{ 
                        width: `${val}%`, 
                        backgroundColor: val > 80 ? 'var(--cy-danger)' : val > 50 ? 'var(--cy-warning)' : 'var(--cy-success)' 
                      }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Center Column: Interactive Sliders at bottom */}
          <div className="fiware-center-rail">
            <div className="fiware-controls-panel fiware-glass-card">
              <h3><Sliders size={16} /> Twin Sandbox Controls</h3>
              <div className="controls-grid">
                
                <div className="control-group">
                  <div className="control-header">
                    <span>PEEP</span>
                    <strong>{controls.peep.toFixed(1)} cmH2O</strong>
                  </div>
                  <input type="range" min="3" max="20" step="0.5" value={controls.peep} onChange={e => handleControlChange('peep', e.target.value)} />
                </div>
                
                <div className="control-group">
                  <div className="control-header">
                    <span>FiO2</span>
                    <strong>{controls.fio2}%</strong>
                  </div>
                  <input type="range" min="21" max="100" step="1" value={controls.fio2} onChange={e => handleControlChange('fio2', e.target.value)} />
                </div>
                
                <div className="control-group">
                  <div className="control-header">
                    <span>Tidal Volume</span>
                    <strong>{controls.volume} mL</strong>
                  </div>
                  <input type="range" min="200" max="800" step="10" value={controls.volume} onChange={e => handleControlChange('volume', e.target.value)} />
                </div>
                
                <div className="control-group">
                  <div className="control-header">
                    <span>Resp Rate</span>
                    <strong>{controls.respRate} bpm</strong>
                  </div>
                  <input type="range" min="6" max="40" step="1" value={controls.respRate} onChange={e => handleControlChange('respRate', e.target.value)} />
                </div>

                <div className="control-group">
                  <div className="control-header">
                    <span>Temperature</span>
                    <strong>{controls.temp.toFixed(1)} °C</strong>
                  </div>
                  <input type="range" min="15" max="40" step="0.1" value={controls.temp} onChange={e => handleControlChange('temp', e.target.value)} />
                </div>

                <div className="control-group">
                  <div className="control-header">
                    <span>Humidity</span>
                    <strong>{controls.humidity}%</strong>
                  </div>
                  <input type="range" min="0" max="100" step="1" value={controls.humidity} onChange={e => handleControlChange('humidity', e.target.value)} />
                </div>

                <div className="control-group" style={{ gridColumn: '1 / -1' }}>
                  <div className="control-header">
                    <span>Atmospheric Pressure (Altitude / Storm)</span>
                    <strong>{controls.atmPressure} hPa</strong>
                  </div>
                  <input type="range" min="700" max="1080" step="1" value={controls.atmPressure} onChange={e => handleControlChange('atmPressure', e.target.value)} />
                </div>

              </div>
            </div>
          </div>

          {/* Right Column: Predictive Analytics & Terminal */}
          <aside className="fiware-rail right-rail">
            
            <div className="fiware-glass-card chart-card">
              <h3>SpO2 History</h3>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={dataHistory}>
                  <YAxis domain={['auto', 'auto']} hide />
                  <Line type="monotone" dataKey="spo2" stroke="var(--cy-success)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="fiware-glass-card chart-card">
              <h3>Pressure Tracking</h3>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={dataHistory}>
                  <YAxis domain={['auto', 'auto']} hide />
                  <Line type="monotone" dataKey="pressure" stroke="var(--cy-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="fiware-glass-card terminal-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3><ShieldCheck size={16} style={{marginRight: '6px'}}/> Blockchain Audit Ledger</h3>
                <button 
                  onClick={handleVerifyLedger}
                  style={{
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid var(--cy-primary)',
                    color: 'var(--cy-primary)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <ShieldCheck size={12} /> Verify Integrity
                </button>
              </div>
              <div className="terminal-window">
                {auditTrail.length === 0 ? <div className="terminal-line">Waiting for blockchain sync...</div> : null}
                {auditTrail.map((block, i) => (
                  <div key={i} className="terminal-line" style={{ borderBottom: '1px dashed rgba(0,240,255,0.2)', paddingBottom: '8px', marginBottom: '8px' }}>
                    <div style={{ color: 'var(--cy-primary)', fontWeight: 'bold' }}>
                      [BLOCK #{block.block_id}] {block.event_type}
                    </div>
                    <div style={{ color: '#88a3b8', fontSize: '10px' }}>Hash: {block.chain_hash.substring(0,24)}...</div>
                    <div style={{ color: '#e2f1ff', marginTop: '4px', wordBreak: 'break-all' }}>
                      {block.payload_json ? (
                        block.payload_json.length > 150 
                          ? block.payload_json.substring(0, 150) + '...' 
                          : block.payload_json
                      ) : (
                        "{}"
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </aside>
        </div>
      </div>
    </div>
  );
}
