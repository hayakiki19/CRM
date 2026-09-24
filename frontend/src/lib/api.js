import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const http = axios.create({ baseURL: API });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("crm_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const apiGet = (path, params) => http.get(path, { params }).then((r) => r.data);
export const apiPost = (path, body) => http.post(path, body).then((r) => r.data);
export const apiPut = (path, body) => http.put(path, body).then((r) => r.data);
export const apiDelete = (path) => http.delete(path).then((r) => r.data);

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n || 0));
