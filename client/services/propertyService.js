import apiClient from "./apiClient.js";

export async function listProperties(params = {}) {
  const response = await apiClient.get("/properties", { params });
  return response.data.data;
}

export async function getPropertyById(propertyId) {
  const response = await apiClient.get(`/properties/${propertyId}`);
  return response.data.data;
}

export async function createProperty(payload) {
  const response = await apiClient.post("/properties", payload);
  return response.data.data;
}
