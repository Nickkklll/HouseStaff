const API_ORIGIN = (
  process.env.REACT_APP_API_ORIGIN || "http://localhost:3000"
).replace(/\/+$/, "");

export function apiUrl(path) {
  return new URL(path, `${API_ORIGIN}/`).toString();
}

export function assetUrl(path) {
  if (!path || /^(blob:|data:)/i.test(path)) return path;

  const parsedUrl = new URL(path, `${API_ORIGIN}/`);
  return new URL(
    `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`,
    `${API_ORIGIN}/`
  ).toString();
}
