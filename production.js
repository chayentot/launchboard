(() => {
  "use strict";

  const BUILD = "10.0.0";

  // Register PWA support without blocking page startup.
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(`service-worker.js?v=${BUILD}`)
        .catch(error => console.error("Service worker registration failed:", error));
    });
  }

  // Report unexpected runtime errors without exposing sensitive data.
  window.addEventListener("error", event => {
    console.error("LaunchBoard runtime error:", event.message, event.filename, event.lineno);
  });

  window.addEventListener("unhandledrejection", event => {
    console.error("LaunchBoard rejected promise:", event.reason);
  });

  // Prevent accidental double submission on forms while preserving validation.
  document.addEventListener("submit", event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.checkValidity()) return;

    const submitter = event.submitter;
    if (!(submitter instanceof HTMLButtonElement)) return;
    if (submitter.dataset.allowRepeat === "true") return;

    const original = submitter.textContent;
    submitter.disabled = true;
    submitter.dataset.originalText = original || "";
    window.setTimeout(() => {
      if (document.contains(submitter)) {
        submitter.disabled = false;
        if (submitter.dataset.originalText) submitter.textContent = submitter.dataset.originalText;
      }
    }, 8000);
  });

  // External links opened in a new tab cannot control the opener.
  document.querySelectorAll('a[target="_blank"]').forEach(link => {
    const rel = new Set((link.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
    rel.add("noopener");
    rel.add("noreferrer");
    link.setAttribute("rel", [...rel].join(" "));
  });

  document.documentElement.dataset.launchboardBuild = BUILD;
})();
