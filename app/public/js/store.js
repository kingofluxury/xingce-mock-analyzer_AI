let cached = null;

async function apiAvailable() {
  if (location.protocol === "file:") return false;
  try {
    const res = await fetch("api/health", { cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true;
  } catch {
    return false;
  }
}

export async function getStore() {
  if (cached) return cached;
  cached = (await apiAvailable()) ? await import("./store-http.js") : await import("./store-local.js");
  return cached;
}
