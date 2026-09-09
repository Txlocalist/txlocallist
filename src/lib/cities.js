export function normalizeCityInput(value) {
  const name = typeof value === "string"
    ? value.normalize("NFC").trim().replace(/\s+/g, " ").replace(/\u2019/g, "'")
    : "";
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (name.length < 2 || name.length > 100 || !slug || !/^[\p{L}\p{M} .'-]+$/u.test(name)) {
    return { error: "Enter a city name between 2 and 100 characters, using letters, spaces, apostrophes, periods or hyphens." };
  }
  return { name, slug, state: "Texas" };
}

export function mergeCityNames(managedNames, eventNames = []) {
  const names = new Map();
  for (const value of [...managedNames, ...eventNames]) {
    const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
    if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

export function formatEventCityLabel(city, state) {
  const cityName = typeof city === "string" ? city.trim().replace(/\s+/g, " ") : "";
  if (!cityName) return "Texas";
  const rawState = typeof state === "string" ? state.trim().toUpperCase() : "";
  const stateName = rawState === "TEXAS" ? "TX" : rawState;
  return stateName ? `${cityName}, ${stateName}` : cityName;
}

export function mergeEventCityLabels(managedCities, events) {
  return mergeCityNames(
    managedCities.map((city) => formatEventCityLabel(city.name, city.state || "TX")),
    events.map((event) => formatEventCityLabel(event.city, event.state)),
  );
}
