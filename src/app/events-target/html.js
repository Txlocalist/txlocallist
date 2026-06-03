import { prisma } from "@/lib/prisma";

import { getEventTestLandingHtml, getEventTestResultsHtml } from "../event-test/html";

const ROOT = "/events-target";
const RESULTS = "/events-target/results";
const DEFAULT_EVENT_TAG_NAMES = [
  "Live Music",
  "Family Friendly",
  "Food & Drink",
  "Networking",
  "Arts & Culture",
  "Outdoor",
  "Wellness",
  "Community",
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function formatCityLabel(city) {
  return String(city)
    .replace(/,\s*[A-Z]{2}$/, "")
    .trim();
}

function formatEventDate(startDate) {
  if (!startDate) return "2026-05-16";
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return "2026-05-16";
  return date.toISOString().slice(0, 10);
}

function formatEventTime(startDate) {
  if (!startDate) return "6:00 PM";
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return "6:00 PM";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago",
  }).format(date);
}

function inferEventType(event) {
  const combinedText = [
    event.title,
    event.description,
    ...(event.tags ?? []).map((tag) => tag.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (combinedText.includes("music") || combinedText.includes("concert") || combinedText.includes("band")) {
    return "Live Music";
  }
  if (combinedText.includes("market") || combinedText.includes("vendor") || combinedText.includes("fair")) {
    return "Markets";
  }
  if (combinedText.includes("food") || combinedText.includes("drink") || combinedText.includes("taco") || combinedText.includes("brew")) {
    return "Food & Drink";
  }
  if (combinedText.includes("outdoor") || combinedText.includes("park") || combinedText.includes("trail")) {
    return "Outdoor";
  }
  if (combinedText.includes("family") || combinedText.includes("kids")) {
    return "Family Friendly";
  }
  if (combinedText.includes("network")) {
    return "Networking";
  }
  if (combinedText.includes("wellness") || combinedText.includes("yoga") || combinedText.includes("fitness")) {
    return "Wellness";
  }
  if (combinedText.includes("art") || combinedText.includes("gallery") || combinedText.includes("museum")) {
    return "Arts & Culture";
  }
  if (combinedText.includes("community") || combinedText.includes("local")) {
    return "Community";
  }

  return event.tags?.[0]?.name || "Community";
}

function inferTicketClass(type) {
  const normalized = String(type).toLowerCase();
  if (normalized.includes("music")) return "teal";
  if (normalized.includes("market") || normalized.includes("food")) return "orange";
  if (normalized.includes("family")) return "yellow";
  if (normalized.includes("night")) return "red";
  if (normalized.includes("outdoor")) return "teal";
  return "yellow";
}

function inferImageClass(type) {
  const normalized = String(type).toLowerCase();
  if (normalized.includes("music")) return "img-music";
  if (normalized.includes("market") || normalized.includes("food")) return "img-market";
  if (normalized.includes("night")) return "img-jazz";
  if (normalized.includes("outdoor")) return "img-outdoor";
  return "img-market";
}

function buildEventDatasetMarkup(events) {
  return `const events = ${JSON.stringify(events, null, 2)};`;
}

function buildInitialEventCardsMarkup(events) {
  if (!events.length) {
    return `<div class="empty" style="padding:24px;border:1px solid rgba(245,231,198,.12);border-radius:20px;background:rgba(255,255,255,.03)">
      <h3 style="margin:0 0 8px;font-family:Georgia,serif;font-style:italic">No events found.</h3>
      <p style="margin:0;color:var(--muted);font-weight:800">Try another city or remove a filter.</p>
    </div>`;
  }

  return events
    .slice(0, 3)
    .map(
      (event) => `
        <article class="event-card">
          <div class="ticket ${event.ticket}">
            <div>
              <div class="month">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(event.date).getDay()].toUpperCase()} ${event.date.slice(5, 7)}</div>
              <div class="date">${new Date(event.date).getDate()}</div>
            </div>
            <div class="time">${event.time}</div>
          </div>
          <div class="thumb ${event.image}"></div>
          <div class="card-body">
            <span class="card-tag">${escapeHtml(event.type)}</span>
            <h2 class="card-title">${escapeHtml(event.title)}<small>${escapeHtml(event.sub)}</small></h2>
            <div class="card-meta">⌖ ${escapeHtml(event.venue)} · ${escapeHtml(event.city)}</div>
            <div class="card-copy">${escapeHtml(event.desc)}</div>
            <div class="meta-row">${event.tags.slice(0, 3).map((tag) => `<span class="mini-tag">${escapeHtml(tag)}</span>`).join("")}</div>
            <div class="actions">
              <button class="tiny-btn ${event.saved ? "saved" : ""}" data-save="${escapeAttr(event.id)}">${event.saved ? "♥ Saved" : "♡ Save"}</button>
              <button class="tiny-btn">▣ Add to Calendar</button>
            </div>
          </div>
        </article>`
    )
    .join("");
}

function buildCitiesMarkup(cities) {
  if (!cities.length) {
    return `        <div class="subnav open" id="citiesNav">
          <div class="sub-item" aria-disabled="true">No cities available</div>
        </div>`;
  }

  return `        <div class="subnav open" id="citiesNav">
${cities
  .map(
    (city, index) =>
      `          <button class="sub-item${index === 0 ? " active-sub" : ""}" data-city="${escapeAttr(city)}">${escapeHtml(formatCityLabel(city))}</button>`
  )
  .join("\n")}
        </div>`;
}

function buildCategoriesMarkup(categories) {
  if (!categories.length) {
    return `        <div class="subnav" id="catsNav">
          <div class="sub-item" aria-disabled="true">No categories available</div>
        </div>`;
  }

  return `        <div class="subnav" id="catsNav">
${categories
  .map(
    (category) =>
      `          <button class="sub-item" data-filter="${escapeAttr(category)}">${escapeHtml(category)}</button>`
  )
  .join("\n")}
        </div>`;
}

async function loadEventsTargetSidebarData() {
  try {
    const [publishedCities, seededEventTags, allTags] = await Promise.all([
      prisma.event.findMany({
        where: { status: "PUBLISHED" },
        distinct: ["city"],
        orderBy: { city: "asc" },
        select: { city: true },
      }),
      prisma.tag.findMany({
        where: { name: { in: DEFAULT_EVENT_TAG_NAMES } },
        orderBy: { name: "asc" },
        select: { name: true },
      }),
      prisma.tag.findMany({
        orderBy: { name: "asc" },
        select: { name: true },
      }),
    ]);

    const categoriesSource = seededEventTags.length > 0 ? seededEventTags : allTags;

    return {
      cities: publishedCities.map((entry) => entry.city).filter(Boolean),
      categories: categoriesSource.map((entry) => entry.name).filter(Boolean),
    };
  } catch (error) {
    console.error("[events-target] failed to load sidebar data", error);
    return { cities: [], categories: [] };
  }
}

async function loadEventsTargetEventsData() {
  try {
    const events = await prisma.event.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        addressName: true,
        address: true,
        city: true,
        state: true,
        startDate: true,
        tags: {
          select: { name: true },
        },
        business: {
          select: { name: true },
        },
      },
    });

    return events.map((event, index) => {
      const type = inferEventType(event);
      const city = formatCityLabel(event.city || "");
      const startDate = event.startDate ? new Date(event.startDate) : null;

      return {
        id: event.id || index + 1,
        date: formatEventDate(event.startDate),
        time: formatEventTime(event.startDate),
        title: event.title || "Untitled Event",
        sub: event.business?.name || event.addressName || event.address || "Local Event",
        venue: event.addressName || event.address || event.business?.name || "Local Venue",
        city,
        type,
        category: type,
        tags: Array.from(new Set([type, ...(event.tags || []).map((tag) => tag.name)])),
        ticket: inferTicketClass(type),
        image: inferImageClass(type),
        saved: false,
        saves: 0,
        desc: event.description || "Local event details coming soon.",
        startTimestamp: startDate ? startDate.toISOString() : null,
      };
    });
  } catch (error) {
    console.error("[events-target] failed to load events data", error);
    return [];
  }
}

function replaceRoutes(html) {
  return html
    .replaceAll("/event-test/results", RESULTS)
    .replaceAll("/event-test", ROOT);
}

function normalizeResultsHtml(html, sidebarData) {
  const citiesMarkup = buildCitiesMarkup(sidebarData.cities);
  const categoriesMarkup = buildCategoriesMarkup(sidebarData.categories);
  const categoryFilterCondition = `else if(${JSON.stringify(sidebarData.categories)}.includes(f)) list = list.filter(e => e.type===f || e.tags.includes(f));`;

  return html
    .replace(
      /<div class="subnav open" id="citiesNav">[\s\S]*?<\/div>\s*<button class="nav-item" data-accordion="catsNav">/,
      `${citiesMarkup}\n\n        <button class="nav-item" data-accordion="catsNav">`
    )
    .replace(
      /<div class="subnav" id="catsNav">[\s\S]*?<\/div>/,
      categoriesMarkup
    )
    .replace(
      /else if\(\[[^\]]*\]\.includes\(f\)\) list = list.filter\(e => e\.type===f \|\| e\.tags\.includes\(f\)\);/,
      categoryFilterCondition
    );
}

function injectLiveEventDataset(html, events) {
  const eventDatasetPattern = /const events = \[[\s\S]*?\n    \];/;
  const eventsMarkup = buildEventDatasetMarkup(events);

  if (!eventDatasetPattern.test(html)) {
    throw new Error("Could not locate mock event dataset in events-target results template.");
  }

  return html.replace(eventDatasetPattern, eventsMarkup);
}

function injectInitialEventCards(html, events) {
  const cardsPattern = /<div class="cards-grid" id="cardsGrid"><\/div>/;
  const initialCardsMarkup = `<div class="cards-grid" id="cardsGrid">${buildInitialEventCardsMarkup(events)}</div>`;

  if (!cardsPattern.test(html)) {
    throw new Error("Could not locate cards grid in events-target results template.");
  }

  return html.replace(cardsPattern, initialCardsMarkup);
}

function injectDefaultEventFallback(html) {
  return html.replace(
    "</body>",
    `
  <script>
    (function () {
      try {
        if (typeof events === "undefined" || !Array.isArray(events) || !events.length) return;

        function normalizeCity(value) {
          return String(value || "")
            .replace(/,?\\s+[A-Z]{2}$/, "")
            .trim();
        }

        var cityCounts = new Map();
        events.forEach(function (event) {
          var city = event && event.city ? normalizeCity(event.city) : "";
          if (!city) return;
          cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
        });

        if (!cityCounts.size) return;

        var params = new URLSearchParams(window.location.search);
        var requestedCity = normalizeCity(params.get("loc"));
        var matchingEvents = requestedCity
          ? events.filter(function (event) {
              return normalizeCity(event && event.city) === requestedCity;
            })
          : [];

        var bestCity = null;
        var bestEvent = null;

        if (matchingEvents.length) {
          matchingEvents.sort(function (left, right) {
            return String(left.date).localeCompare(String(right.date)) || String(left.time).localeCompare(String(right.time));
          });
          bestCity = requestedCity;
          bestEvent = matchingEvents[0];
        } else {
          var bestCount = -1;
          cityCounts.forEach(function (count, city) {
            if (count > bestCount) {
              bestCity = city;
              bestCount = count;
            }
          });

          var cityEvents = events.filter(function (event) {
            return normalizeCity(event && event.city) === bestCity;
          });

          if (!cityEvents.length) return;

          cityEvents.sort(function (left, right) {
            return String(left.date).localeCompare(String(right.date)) || String(left.time).localeCompare(String(right.time));
          });

          bestEvent = cityEvents[0];
        }

        var cityInput = document.getElementById("cityInput");
        if (cityInput) cityInput.value = bestCity;

        if (typeof state !== "undefined") {
          state.city = bestCity;
          state.selectedDate = bestEvent.date;
          state.month = new Date(bestEvent.date + "T00:00:00");
          if (state.filters && typeof state.filters.clear === "function") {
            state.filters.clear();
          }
          if (state.filters && typeof state.filters.add === "function") {
            state.filters.add("This Weekend");
          }
        }

        if (typeof renderAll === "function") renderAll(false);
        if (typeof syncUrlFromState === "function") syncUrlFromState();
      } catch (error) {
        console.error("[events-target] default fallback failed", error);
      }
    })();
  </script>
</body>`
  );
}

export async function getEventsTargetLandingHtml() {
  const html = await getEventTestLandingHtml();
  return replaceRoutes(html);
}

export async function getEventsTargetResultsHtml() {
  const html = replaceRoutes(await getEventTestResultsHtml());
  const sidebarData = await loadEventsTargetSidebarData();
  const events = await loadEventsTargetEventsData();

  return injectDefaultEventFallback(
    injectInitialEventCards(
      normalizeResultsHtml(injectLiveEventDataset(html, events), sidebarData),
      events
    )
  );
}
