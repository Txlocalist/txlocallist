export async function deleteOwnedBusinessAction(input) { return remove(input); }
export async function deleteOwnedEventAction(input) { return remove(input); }
async function remove(input) {
  window.deletionCalls = [...(window.deletionCalls || []), input];
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (window.deletionError) return { success: false, error: window.deletionError };
  return { success: true };
}
export async function createCityAction(previous, data) {
  const { normalizeCityInput } = await import("@/lib/cities");
  const city = normalizeCityInput(data.get("name"));
  if (city.error) return { error: city.error, fieldErrors: { name: city.error }, success: "" };
  localStorage.setItem("fixtureCity", city.name);
  return { error: "", fieldErrors: {}, success: `${city.name} is now available in business forms and Explore.` };
}
export async function renameCityAction(previous, data) {
  window.citySubmissions = [...(window.citySubmissions || []), Object.fromEntries(data)];
  const { normalizeCityInput } = await import("@/lib/cities");
  const input = normalizeCityInput(data.get("name"));
  const error = window.cityError || input.error;
  if (error) return { error, fieldErrors: { name: error }, success: "" };
  return { error: "", fieldErrors: {}, success: `City renamed to ${input.name}.` };
}
export async function deleteCityAction(previous, data) {
  window.citySubmissions = [...(window.citySubmissions || []), Object.fromEntries(data)];
  if (window.cityError) return { error: window.cityError, fieldErrors: {}, success: "" };
  return { error: "", fieldErrors: {}, success: "City deleted. Listings moved to Uncategorized." };
}
export async function createBusinessFromFormAction() { return { success: true, data: { id: "fixture" } }; }
export async function createCategoryAction(previous, data) {
  const { normalizeCategoryInput } = await import("@/lib/categories");
  const input = normalizeCategoryInput(data.get("name"));
  const error = window.categoryError || input.error;
  if (error) return { error, fieldErrors: { name: error }, success: "" };
  localStorage.setItem(data.get("type") === "event" ? "fixtureEventCategory" : "fixtureBusinessCategory", input.name);
  return { error: "", fieldErrors: {}, success: `${input.name} is now available in ${data.get("type")} forms.` };
}
export async function renameCategoryAction(previous, data) {
  window.categorySubmissions = [...(window.categorySubmissions || []), Object.fromEntries(data)];
  const error = window.categoryError;
  if (error) return { error, fieldErrors: { name: error }, success: "" };
  return { error: "", fieldErrors: {}, success: `${data.get("name")} saved. Existing listings will show the new name.` };
}
export async function publishBusinessAction() { return { success: true }; }
export async function updateBusinessAction() { return { success: true }; }
export async function createEventAction(previous, data) {
  window.eventSubmissions = [...(window.eventSubmissions || []), Object.fromEntries(data)];
  return { error: window.eventSubmissionError || "", fieldErrors: {} };
}
export const updateEventAction = createEventAction;
