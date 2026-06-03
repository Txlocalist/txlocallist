import { promises as fs } from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/prisma";

const LANDING_PATH = path.join(
  process.cwd(),
  "Brandons HTML",
  "tx-localist-events-landing (3).html"
);

const RESULTS_PATH = path.join(
  process.cwd(),
  "Brandons HTML",
  "tx-localist-events-mockup-ticket-calendar.html"
);

const TEST_ROOT = "/event-test";
const TEST_RESULTS = "/event-test/results";

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

function normalizeEventTestLandingHtml(html) {
  return html
    .replace(
      '<a href="#" class="login-btn">Login</a>',
      '<a href="/login" class="login-btn">LOGIN</a>'
    )
    .replace(
      '<h1 class="headline" id="page-title">Find whatâ€™s <span>happening.<em class="star">â˜…</em></span></h1>',
      '<h1 class="headline" id="page-title">Find Texas <span>Events.<em class="star">â˜…</em></span> Fast.</h1>'
    )
    .replace(
      '<p class="hero-sub">Live music, local events, and weekend plans â€”<br>without the noise.</p>',
      '<p class="hero-sub">Search local events across Texas,<br>from pop-ups to live music and community gatherings.</p>'
    );
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

async function loadEventSidebarData() {
  try {
    const [publishedCities, publishedTags] = await Promise.all([
      prisma.event.findMany({
        where: { status: "PUBLISHED" },
        distinct: ["city"],
        orderBy: { city: "asc" },
        select: { city: true },
      }),
      prisma.tag.findMany({
        where: {
          events: {
            some: { status: "PUBLISHED" },
          },
        },
        orderBy: { name: "asc" },
        select: { name: true },
      }),
    ]);

    return {
      cities: publishedCities.map((entry) => entry.city).filter(Boolean),
      categories: publishedTags.map((entry) => entry.name).filter(Boolean),
    };
  } catch (error) {
    console.error("[event-test] failed to load sidebar data", error);
    return { cities: [], categories: [] };
  }
}

function normalizeEventTestResultsHtml(html, sidebarData) {
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
      "else if(['Live Music','Markets','Food & Drink','Outdoor','Family'].includes(f)) list = list.filter(e => e.type===f || e.tags.includes(f));",
      categoryFilterCondition
    );
}

function injectBeforeBodyClose(html, script) {
  if (!html.includes("</body>")) {
    throw new Error("Template is missing a closing </body> tag.");
  }

  return html.replace("</body>", `${script}\n</body>`);
}

function landingEnhancements() {
  return `
  <script>
    (function () {
      var targetRoute = ${JSON.stringify(TEST_RESULTS)};
      var eventSearch = document.getElementById("eventSearch");
      var eventCity = document.getElementById("eventCity");
      var dateValue = document.getElementById("dateValue");
      var headline = document.getElementById("page-title");
      var heroSub = document.querySelector(".hero-sub");
      var form = document.querySelector(".search-shell");
      var logoLinks = document.querySelectorAll(".logo");
      var loginButton = document.querySelector(".login-btn");
      var ctaButton = document.querySelector(".primary-btn");
      var navLinks = Array.from(document.querySelectorAll(".nav-links a"));

      logoLinks.forEach(function (link) {
        link.setAttribute("href", ${JSON.stringify(TEST_ROOT)});
      });

      if (loginButton) {
        loginButton.textContent = "LOGIN";
        loginButton.setAttribute("href", "/login");
      }

      if (ctaButton) {
        ctaButton.setAttribute("href", targetRoute);
      }

      if (headline) {
        headline.innerHTML = 'Find Texas <span>Events.<em class="star">★</em></span> Fast.';
      }

      if (heroSub) {
        heroSub.textContent = "Search local events across Texas, from pop-ups to live music and community gatherings.";
      }

      [
        { text: "EXPLORE", href: targetRoute },
        { text: "HOW IT WORKS", href: "/how-it-works" },
        { text: "ABOUT", href: "/about" },
        { text: "PRICING", href: "/pricing" },
        { text: "ADD LISTING", href: "/post-your-business" }
      ].forEach(function (linkInfo, index) {
        var link = navLinks[index];
        if (!link) return;
        link.textContent = linkInfo.text;
        link.setAttribute("href", linkInfo.href);
      });

      document.querySelectorAll(".footer-links a").forEach(function (link) {
        var label = link.textContent.trim().toLowerCase();
        if (label === "about") link.setAttribute("href", "/about");
        if (label === "how it works") link.setAttribute("href", "/how-it-works");
        if (label === "terms") link.setAttribute("href", "/terms");
        if (label === "privacy") link.setAttribute("href", "/privacy");
        if (label === "contact") link.setAttribute("href", "/contact");
      });

      document.querySelectorAll(".section-link").forEach(function (link) {
        var label = link.textContent.trim().toLowerCase();
        if (label.includes("view full calendar")) {
          link.setAttribute("href", targetRoute + "?date=this-weekend");
        }
        if (label.includes("explore all categories")) {
          link.setAttribute("href", targetRoute);
        }
      });

      if (form) {
        form.setAttribute("action", targetRoute);
        form.addEventListener("submit", function () {
          var params = new URLSearchParams();
          if (eventSearch && eventSearch.value.trim()) params.set("q", eventSearch.value.trim());
          if (eventCity && eventCity.value.trim()) params.set("loc", eventCity.value.trim());
          if (dateValue && dateValue.value) params.set("date", dateValue.value);
          window.location.href = targetRoute + (params.toString() ? "?" + params.toString() : "");
        });
      }

      Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (chip) {
        var text = chip.textContent.toLowerCase();
        if (text.includes("live music")) chip.setAttribute("href", targetRoute + "?q=live%20music&date=this-weekend");
        if (text.includes("this weekend")) chip.setAttribute("href", targetRoute + "?date=this-weekend");
        if (text.includes("free events")) chip.setAttribute("href", targetRoute + "?q=free&date=this-weekend");
        if (text.includes("outdoor")) chip.setAttribute("href", targetRoute + "?q=outdoor&date=this-weekend");
        if (text.includes("markets")) chip.setAttribute("href", targetRoute + "?q=market&date=this-weekend");
        if (text.includes("family friendly")) chip.setAttribute("href", targetRoute + "?q=family&date=this-weekend");
        if (text.includes("nightlife")) chip.setAttribute("href", targetRoute + "?q=nightlife&date=this-weekend");
      });
    })();
  </script>`;
}

function resultsEnhancements() {
  return `
  <script>
    (function () {
      var landingRoute = ${JSON.stringify(TEST_ROOT)};
      var resultsRoute = ${JSON.stringify(TEST_RESULTS)};
      var presetInput = document.getElementById("datePreset");
      var queryInput = document.getElementById("queryInput");
      var cityInput = document.getElementById("cityInput");
      var searchForm = document.getElementById("searchForm");
      var loginButton = document.querySelector(".login-btn");
      var brandLink = document.querySelector(".brand");
      var viewFullDayButton = Array.from(document.querySelectorAll(".today-btn")).find(function (button) {
        return button.textContent.trim().toLowerCase() === "view full day";
      });
      var addListingButton = Array.from(document.querySelectorAll(".nav-item")).find(function (button) {
        return button.textContent.toLowerCase().includes("add listing");
      });
      var availableDates = Array.from(new Set(events.map(function (event) {
        return event.date;
      }))).sort();
      var firstDate = availableDates[0] || state.selectedDate;
      var secondDate = availableDates[1] || firstDate;

      function clearPresetFilters() {
        ["Tonight", "This Weekend", "Next 7 Days", "today", "tomorrow"].forEach(function (filter) {
          state.filters.delete(filter);
        });

        Array.from(state.filters).forEach(function (filter) {
          if (/^\\d{4}-\\d{2}-\\d{2}$/.test(filter)) {
            state.filters.delete(filter);
          }
        });
      }

      function formatShortDate(dateKey) {
        var date = dateObj(dateKey);
        return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      }

      function ensureCustomOption(value, label) {
        if (!presetInput) return;
        var existing = Array.from(presetInput.options).find(function (option) {
          return option.value === value;
        });

        if (!existing) {
          existing = document.createElement("option");
          existing.value = value;
          presetInput.appendChild(existing);
        }

        existing.textContent = label;
      }

      function applyDateParam(dateParam) {
        clearPresetFilters();

        if (!presetInput) return;

        if (dateParam === "This Weekend" || dateParam === "this-weekend") {
          state.filters.add("This Weekend");
          presetInput.value = "This Weekend";
          return;
        }

        if (dateParam === "Tonight" || dateParam === "tonight") {
          state.filters.add("Tonight");
          state.selectedDate = firstDate;
          state.month = new Date(dateObj(firstDate).getFullYear(), dateObj(firstDate).getMonth(), 1);
          presetInput.value = "Tonight";
          return;
        }

        if (dateParam === "Next 7 Days" || dateParam === "next-7-days") {
          state.filters.add("Next 7 Days");
          presetInput.value = "Next 7 Days";
          return;
        }

        if (!dateParam) {
          presetInput.value = "All";
          return;
        }

        if (dateParam === "today") {
          ensureCustomOption("today", "Today");
          state.selectedDate = firstDate;
          state.month = new Date(dateObj(firstDate).getFullYear(), dateObj(firstDate).getMonth(), 1);
          presetInput.value = "today";
          return;
        }

        if (dateParam === "tomorrow") {
          ensureCustomOption("tomorrow", "Tomorrow");
          state.selectedDate = secondDate;
          state.month = new Date(dateObj(secondDate).getFullYear(), dateObj(secondDate).getMonth(), 1);
          presetInput.value = "tomorrow";
          return;
        }

        if (/^\\d{4}-\\d{2}-\\d{2}$/.test(dateParam)) {
          ensureCustomOption(dateParam, formatShortDate(dateParam));
          state.selectedDate = dateParam;
          state.month = new Date(dateObj(dateParam).getFullYear(), dateObj(dateParam).getMonth(), 1);
          presetInput.value = dateParam;
          return;
        }

        presetInput.value = "All";
      }

      function syncUrlFromState() {
        var params = new URLSearchParams();
        var query = queryInput ? queryInput.value.trim() : state.query.trim();
        var city = cityInput ? cityInput.value.trim() : state.city.trim();
        var preset = presetInput ? presetInput.value : "All";

        if (query) params.set("q", query);
        if (city) params.set("loc", city);

        if (preset === "This Weekend") params.set("date", "this-weekend");
        else if (preset === "Tonight") params.set("date", "tonight");
        else if (preset === "Next 7 Days") params.set("date", "next-7-days");
        else if (preset === "today" || preset === "tomorrow" || /^\\d{4}-\\d{2}-\\d{2}$/.test(preset)) params.set("date", preset);

        window.history.replaceState({}, "", resultsRoute + (params.toString() ? "?" + params.toString() : ""));
      }

      function applyIncomingParams() {
        var params = new URLSearchParams(window.location.search);
        var query = params.get("q");
        var city = params.get("loc");
        var date = params.get("date");

        if (typeof query === "string") {
          state.query = query;
          if (queryInput) queryInput.value = query;
        }

        if (typeof city === "string" && city.trim()) {
          state.city = city.trim();
          if (cityInput) cityInput.value = state.city;
        }

        applyDateParam(date);
      }

      if (brandLink) brandLink.setAttribute("href", landingRoute);
      if (loginButton) loginButton.addEventListener("click", function () { window.location.href = "/login"; });
      if (addListingButton) addListingButton.addEventListener("click", function () { window.location.href = "/post-your-business"; });
      if (viewFullDayButton) {
        viewFullDayButton.addEventListener("click", function () {
          setView("list");
          document.querySelector(".left-column")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }

      applyIncomingParams();
      renderAll(false);
      syncUrlFromState();

      if (searchForm) {
        searchForm.addEventListener("submit", function () {
          state.query = queryInput ? queryInput.value.trim() : "";
          state.city = cityInput && cityInput.value.trim() ? cityInput.value.trim() : "Austin, TX";
          applyDateParam(presetInput ? presetInput.value : "All");
          renderAll(false);
          syncUrlFromState();
        });
      }

      Array.from(document.querySelectorAll(".bottom-nav button")).forEach(function (button) {
        if (button.dataset.bottom === "login") {
          button.onclick = function () {
            window.location.href = "/login";
          };
        }
      });
    })();
  </script>`;
}

export async function getEventTestLandingHtml() {
  const html = await fs.readFile(LANDING_PATH, "utf8");
  return injectBeforeBodyClose(normalizeEventTestLandingHtml(html), landingEnhancements());
}

export async function getEventTestResultsHtml() {
  const html = await fs.readFile(RESULTS_PATH, "utf8");
  const sidebarData = await loadEventSidebarData();
  return injectBeforeBodyClose(
    normalizeEventTestResultsHtml(html, sidebarData),
    resultsEnhancements()
  );
}
