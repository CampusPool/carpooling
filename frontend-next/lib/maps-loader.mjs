const SDK_ID = "mobility-google-maps-sdk";

export function loadMapsSdk({ fetchImpl, documentRef, google, onReady, onUnavailable }) {
  let active = true;
  let script = null;
  const fail = (message) => {
    if (active) onUnavailable(message);
  };
  const ready = () => {
    if (active) onReady();
  };
  const onError = () => {
    if (script?.parentNode) script.parentNode.removeChild(script);
    fail("Google Maps could not load. Check the browser key, network, and Places API access.");
  };
  fetchImpl("/api/maps/config", { cache: "no-store" })
    .then((response) => response.status === 404
      ? fetchImpl("/mobility-pilot/maps-config", { cache: "no-store" })
      : response)
    .then(async (response) => {
      if (!response.ok) throw Error("Map configuration is unavailable.");
      const config = await response.json();
      if (!config?.browser_key) throw Error("No Google Maps browser key is configured.");
      if (!active) return;
      const currentGoogle = documentRef.defaultView?.google || google;
      if (currentGoogle?.maps?.places || currentGoogle?.maps?.importLibrary) return ready();
      script = documentRef.getElementById(SDK_ID);
      if (!script) {
        script = documentRef.createElement("script");
        script.id = SDK_ID;
        script.async = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.browser_key)}&libraries=places`;
        script.addEventListener("load", () => { if (script.dataset) script.dataset.mobilityLoaded = "true"; }, { once: true });
        script.addEventListener("load", ready, { once: true });
        script.addEventListener("error", onError, { once: true });
        documentRef.head.appendChild(script);
        return;
      }
      if (script.dataset?.mobilityLoaded === "true") return ready();
      script.addEventListener("load", ready, { once: true });
      script.addEventListener("error", onError, { once: true });
    })
    .catch((error) => fail(error.message || "Google Maps is unavailable."));
  return () => {
    active = false;
    if (script) {
      script.removeEventListener("load", ready);
      script.removeEventListener("error", onError);
    }
  };
}
