import apiClient from "./apiClient.js";

export async function getSystemHealth() {
  const response = await apiClient.get("/health");
  return response.data;
}
