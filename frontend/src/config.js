const configuredApiOrigin = process.env.REACT_APP_API_ORIGIN;
const isDevelopment = process.env.NODE_ENV === "development";

if (process.env.NODE_ENV === "production" && !configuredApiOrigin) {
  throw new Error("REACT_APP_API_ORIGIN must be set for production builds.");
}

const API_ORIGIN = (
  isDevelopment
    ? "http://localhost:3000"
    : configuredApiOrigin || "http://localhost:3000"
).replace(/\/+$/, "");

export function apiUrl(path) {
  return new URL(path, `${API_ORIGIN}/`).toString();
}

export function assetUrl(path) {
  if (!path || /^(blob:|data:)/i.test(path)) return path;

  const parsedUrl = new URL(path, `${API_ORIGIN}/`);
  const isLegacyBackendAsset = parsedUrl.pathname.startsWith("/uploads/");
  if (
    parsedUrl.origin !== new URL(API_ORIGIN).origin &&
    !isLegacyBackendAsset
  ) {
    return parsedUrl.toString();
  }

  return new URL(
    `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`,
    `${API_ORIGIN}/`
  ).toString();
}
