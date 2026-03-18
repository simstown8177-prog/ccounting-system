if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    let isRefreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (isRefreshing) {
        return;
      }
      isRefreshing = true;
      window.location.reload();
    });

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      registration.update().catch(() => {
        // Ignore update polling failures.
      });
    } catch {
      // Ignore registration failures in unsupported environments.
    }
  });
}
