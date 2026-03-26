const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

const envBackendUrl = (import.meta.env.VITE_BACKEND_URL || "").trim();
const defaultProtocol = window.location.protocol === "https:" ? "https" : "http";
const defaultBackendUrl = `${defaultProtocol}://${window.location.hostname}:8085`;

export const backendBaseUrl = trimTrailingSlash(envBackendUrl || defaultBackendUrl);
export const backendWsUrl = `${backendBaseUrl}/ws`;
