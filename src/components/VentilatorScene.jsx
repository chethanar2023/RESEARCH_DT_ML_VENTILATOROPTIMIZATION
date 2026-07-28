import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_DAE = "/model/Ventilator.dae";
const MODEL_GLB = "/ventilator.glb";

function clinicalMaterial(color, roughness = 0.48, metalness = 0.12) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function frameModel(group, targetSize = 3.2) {
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / maxAxis;
  group.scale.setScalar(scale);
  group.position.sub(center.multiplyScalar(scale));
  group.position.y -= 0.85;
}

function applyClinicalMaterials(root) {
  const palette = {
    base: clinicalMaterial(0x2f8f7f, 0.45, 0.18),
    tube: clinicalMaterial(0x111827, 0.38, 0.08),
    other: clinicalMaterial(0x0e7490, 0.48, 0.1),
  };
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const label = `${node.name || ""} ${node.material?.name || ""}`.toLowerCase();
    if (label.includes("tube")) node.material = palette.tube;
    else if (label.includes("base")) node.material = palette.base;
    else node.material = palette.other;
  });
}

function buildPlaceholder(group) {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 2.0, 1.1),
    clinicalMaterial(0x2f8f7f),
  );
  body.position.y = 0.2;
  group.add(body);

  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.85, 0.1),
    clinicalMaterial(0x0f172a, 0.3, 0.05),
  );
  screen.position.set(0, 0.55, 0.58);
  screen.name = "Screen";
  group.add(screen);

  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 2.4, 20),
    clinicalMaterial(0x111827),
  );
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0.9, 0.35, 0);
  tube.name = "Tubes";
  group.add(tube);

  return { screen };
}

export default function VentilatorScene({
  alertLevel = "STABLE",
  spo2 = 95,
  respRate = 12,
  peep = 5,
  fio2 = 40,
  tidalVol = 450,
  pressure = 15,
  onStatusChange,
}) {
  const safeSpo2 = Number.isFinite(spo2) ? spo2 : 95;
  const safeRespRate = Number.isFinite(respRate) ? respRate : 12;
  const safePeep = Number.isFinite(peep) ? peep : 5;
  const safeFio2 = Number.isFinite(fio2) ? fio2 : 40;
  const safeTidalVol = Number.isFinite(tidalVol) ? tidalVol : 450;
  const safePressure = Number.isFinite(pressure) ? pressure : 15;

  const mountRef = useRef(null);
  const paramsRef = useRef({ respRate: 12 });
  const stateRef = useRef({
    screen: null,
    lungs: [],
    bellows: null,
    fan: null,
    root: null,
    loaded: "placeholder",
  });

  // Track live telemetries inside ref to avoid re-initializing WebGL on vital ticks
  useEffect(() => {
    paramsRef.current = {
      respRate: safeRespRate,
    };
  }, [safeRespRate]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const width = mount.clientWidth || 640;
    const height = mount.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);
    scene.fog = new THREE.Fog(0x0b1220, 8, 22);

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    camera.position.set(5.5, 3.8, 6.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.85);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(6, 9, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x60a5fa, 0.35);
    fill.position.set(-4, 2, -3);
    scene.add(fill);

    const grid = new THREE.GridHelper(14, 24, 0x334155, 0x1e293b);
    grid.position.y = -1.05;
    scene.add(grid);

    const root = new THREE.Group();
    scene.add(root);
    stateRef.current.root = root;

    const placeholder = new THREE.Group();
    root.add(placeholder);
    const placeholderParts = buildPlaceholder(placeholder);
    stateRef.current.screen = placeholderParts.screen;

    const patient = new THREE.Group();
    const lungMat = clinicalMaterial(0x5eead4, 0.35, 0.05);
    const lungL = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), lungMat);
    const lungR = lungL.clone();
    lungL.scale.set(0.75, 1.2, 0.35);
    lungR.scale.set(0.75, 1.2, 0.35);
    lungL.position.set(-0.28, -0.42, -2.9);
    lungR.position.set(0.28, -0.42, -2.9);
    patient.add(lungL, lungR);
    placeholder.add(patient);
    stateRef.current.lungs = [lungL, lungR];

    const bellows = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.38, 0.65),
      clinicalMaterial(0x7dd3fc, 0.4, 0.05),
    );
    bellows.position.set(0, -0.38, -0.15);
    placeholder.add(bellows);
    stateRef.current.bellows = bellows;

    const fan = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.12, 24),
      clinicalMaterial(0x1e293b, 0.35, 0.2),
    );
    fan.rotation.x = Math.PI / 2;
    fan.position.set(0, -0.2, 0.68);
    placeholder.add(fan);
    stateRef.current.fan = fan;

    frameModel(placeholder, 3.4);

    const attachModel = (model, source) => {
      placeholder.clear();
      placeholder.visible = false;
      stateRef.current.lungs = [];
      stateRef.current.bellows = null;
      stateRef.current.fan = null;
      stateRef.current.screen = null;
      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      applyClinicalMaterials(model);
      root.add(model);
      frameModel(model, 3.4);
      model.rotation.y = -0.35;
      stateRef.current.loaded = source;
      onStatusChange?.(source);
    };

    const showPlaceholder = () => {
      placeholder.visible = true;
      stateRef.current.loaded = "placeholder";
      onStatusChange?.("placeholder");
    };

    const loadGLTF = () => {
      try {
        const gltf = new GLTFLoader();
        gltf.load(
          MODEL_GLB,
          (asset) => {
            try {
              if (asset?.scene) attachModel(asset.scene, "ventilator-glb");
            } catch (err) {
              console.warn("GLTF attach failed, using placeholder...", err);
              showPlaceholder();
            }
          },
          undefined,
          () => {
            showPlaceholder();
          },
        );
      } catch (err) {
        console.warn("GLTFLoader load failed, using placeholder...", err);
        showPlaceholder();
      }
    };

    try {
      const collada = new ColladaLoader();
      collada.load(
        MODEL_DAE,
        (asset) => {
          try {
            if (asset?.scene) attachModel(asset.scene, "medical-ventilator");
          } catch (err) {
            console.warn("Collada attach failed, trying GLTF...", err);
            loadGLTF();
          }
        },
        undefined,
        () => {
          loadGLTF();
        },
      );
    } catch (err) {
      console.warn("ColladaLoader load failed, trying GLTF...", err);
      loadGLTF();
    }

    let dragging = false;
    let lastX = 0;
    const onDown = (e) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onUp = () => {
      dragging = false;
    };
    const onMove = (e) => {
      if (!dragging) return;
      root.rotation.y += (e.clientX - lastX) * 0.006;
      lastX = e.clientX;
    };
    const onWheel = (e) => {
      e.preventDefault();
      camera.position.multiplyScalar(e.deltaY > 0 ? 1.05 : 0.95);
      camera.position.clampLength(4.5, 14);
      camera.lookAt(0, 0, 0);
    };

    renderer.domElement.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const clock = new THREE.Clock();
    let raf = null;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const currentRespRate = paramsRef.current.respRate;
      const breathHz = Math.max(currentRespRate, 8) / 60;
      const breath = (Math.sin(t * breathHz * Math.PI * 2) + 1) / 2;
      const scale = 1 + breath * 0.16;
      stateRef.current.lungs.forEach((lung) => {
        lung.scale.set(0.75 * scale, 1.2 * scale, 0.35 * scale);
      });
      if (stateRef.current.bellows) {
        stateRef.current.bellows.scale.y = 0.85 + breath * 0.4;
      }
      if (stateRef.current.fan) {
        stateRef.current.fan.rotation.z = t * 3.2;
      }
      if (!dragging) root.rotation.y += 0.0015;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || 640;
      const h = mount.clientHeight || 480;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const screen = stateRef.current.screen;
    if (!screen?.material?.emissive) return;
    const level = String(alertLevel || "STABLE").toUpperCase();
    if (level === "CRITICAL" || safeSpo2 < 88) {
      screen.material.emissive.setHex(0xef4444);
      screen.material.emissiveIntensity = 0.85;
    } else if (level === "WARNING" || safeSpo2 < 93) {
      screen.material.emissive.setHex(0xf59e0b);
      screen.material.emissiveIntensity = 0.7;
    } else {
      screen.material.emissive.setHex(0x2563eb);
      screen.material.emissiveIntensity = 0.45;
    }
  }, [alertLevel, safeSpo2]);

  useEffect(() => {
    onStatusChange?.(
      `${stateRef.current.loaded} · PEEP ${safePeep} · FiO₂ ${safeFio2}% · TV ${safeTidalVol} mL · P ${safePressure}`,
    );
  }, [safePeep, safeFio2, safeTidalVol, safePressure, onStatusChange]);

  return (
    <div className="ventilatorSceneWrap">
      <div ref={mountRef} className="ventilatorSceneMount" />
      <div className="ventilatorSceneOverlay">
        <span>SpO₂ {safeSpo2.toFixed(1)}%</span>
        <span>RR {safeRespRate.toFixed(0)} /min</span>
        <span className={`twinAlertChip ${String(alertLevel).toLowerCase()}`}>{alertLevel}</span>
      </div>
      <p className="ventilatorSceneHint">Drag to rotate · scroll to zoom · model: medical-ventilator</p>
    </div>
  );
}
