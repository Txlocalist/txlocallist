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
export async function createBusinessFromFormAction() { return { success: true, data: { id: "fixture" } }; }
export async function publishBusinessAction() { return { success: true }; }
export async function updateBusinessAction() { return { success: true }; }
export async function createEventAction(previous, data) {
  window.eventSubmissions = [...(window.eventSubmissions || []), Object.fromEntries(data)];
  return { error: window.eventSubmissionError || "", fieldErrors: {} };
}
export const updateEventAction = createEventAction;
