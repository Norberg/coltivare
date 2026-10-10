/** Match origin-only allow-list entries locally, while retaining the Pages project path. */
export function authRedirectUrl(address: string) {
  const url = new URL(address);
  return url.origin + (url.pathname === "/" ? "" : url.pathname);
}

/** Auth fragments share the hash with the app router, so detect them before loading local data. */
export function isAuthReturn(address: string) {
  const url = new URL(address);
  const fragment = new URLSearchParams(url.hash.slice(1));
  return (
    url.searchParams.has("code") ||
    [url.searchParams, fragment].some((params) =>
      ["access_token", "error", "error_code", "error_description"].some((key) =>
        params.has(key),
      ),
    )
  );
}

export function clearAuthReturn() {
  const url = new URL(window.location.href);
  for (const key of ["code", "error", "error_code", "error_description"])
    url.searchParams.delete(key);
  url.hash = "";
  window.history.replaceState(window.history.state, "", url);
}
