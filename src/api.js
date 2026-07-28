export const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000`;

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.detail || body.message || JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `${path} failed with ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => request("/health"),
  patients: () => request("/patients"),
  history: (stayId) => request(`/patient/${stayId}/history`),
  tick: (stayId) => request(`/patient/${stayId}/tick`, { method: "POST" }),
  recommend: (stayId, payload) =>
    request(`/patient/${stayId}/recommend`, { method: "POST", body: JSON.stringify(payload) }),
  risks: (stayId, history) =>
    request(`/patient/${stayId}/risks`, { method: "POST", body: JSON.stringify({ history }) }),
  scenarios: () => request("/tests/run-scenarios"),
  evaluation: () => request("/model/evaluation"),
  auditVerify: () => request("/audit/verify"),
  auditFeed: () => request("/audit/feed"),
  auditTrail: (stayId) => request(`/patient/${stayId}/audit_trail`),
  auditAction: (stayId, payload) =>
    request(`/patient/${stayId}/audit`, { method: "POST", body: JSON.stringify(payload) }),
  fiware: () => request("/fiware/status"),
  twinReplay: (payload) => request("/twin/replay", { method: "POST", body: JSON.stringify(payload) }),
};
