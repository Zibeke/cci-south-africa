import axios from 'axios';

export const API_BASE_URL = (process.env.REACT_APP_API_URL || '').replace(/\/+$/, '');

export function backendUrl(path) {
  if (!path || /^https?:\/\//i.test(path) || !API_BASE_URL) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const api = axios.create({
  baseURL: API_BASE_URL || undefined,
  withCredentials: true
});

let authGeneration = 0;
let nextRequestId = 0;
const pendingRequests = new Map();

api.interceptors.request.use((config) => {
  if (config.skipAuthTracking) return config;
  const source = axios.CancelToken.source();
  const requestId = ++nextRequestId;
  config.authRequestId = requestId;
  config.authGeneration = authGeneration;
  config.cancelToken = source.token;
  pendingRequests.set(requestId, source);
  return config;
});

api.interceptors.response.use((response) => {
  const { authRequestId, authGeneration: requestGeneration } = response.config;
  if (authRequestId !== undefined) pendingRequests.delete(authRequestId);
  if (requestGeneration !== undefined && requestGeneration !== authGeneration) {
    return Promise.reject(new axios.Cancel('Authentication state changed.'));
  }
  return response;
}, (error) => {
  if (error.config?.authRequestId !== undefined) pendingRequests.delete(error.config.authRequestId);
  return Promise.reject(error);
});

export function invalidatePendingRequests() {
  authGeneration += 1;
  pendingRequests.forEach((source) => source.cancel('Authentication state changed.'));
  pendingRequests.clear();
}
