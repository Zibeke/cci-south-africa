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
