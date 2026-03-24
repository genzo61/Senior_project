import axios from 'axios';

const backendBaseUrl =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || `http://${window.location.hostname}:8085`;

export const apiClient = axios.create({
  baseURL: backendBaseUrl,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function getBackendBaseUrl() {
  return backendBaseUrl;
}

export function getAiEndpoint() {
  const endpoint = import.meta.env.VITE_AI_CHAT_ENDPOINT;
  if (!endpoint) {
    return null;
  }
  return endpoint.replace(/\/$/, '');
}
