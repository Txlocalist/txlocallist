import { promises as fs } from "node:fs";
import path from "node:path";

import logoImage from "@/app/assets/Tx-Localist-01.png";
import { getEventTestLandingHtml } from "../event-test/html";
import { prisma } from "@/lib/prisma";

const ROOT = "/events";
const RESULTS = "/events/results";
const RESULTS_TEMPLATE_PATH = path.join(
  process.cwd(),
  "Brandons HTML",
  "tx-localist-events-mockup-ticket-calendar.html"
);

function replaceRoutes(html) {
  return html
    .replaceAll("/event-test/results", RESULTS)
    .replaceAll("/event-test", ROOT)
    .replaceAll('href="#" class="logo" aria-label="Texas Localist home"', 'href="/" class="logo" aria-label="Texas Localist home"');
}

function formatCity(event) {
  const city = String(event.city || "").trim();
  const state = String(event.state || "").trim().toUpperCase();

  if (!city) return "Texas";
  return state ? `${city}, ${state}` : city;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeScriptJson(value) {
  return JSON.stringify(value, null, 6)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function formatEventDate(startDate) {
  if (!startDate) return "2026-05-16";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(startDate));

  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function formatEventTime(startDate) {
  if (!startDate) return "6:00 PM";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(startDate));
}

function inferEventType(event) {
  const text = [
    event.title,
    event.description,
    ...(event.tags || []).map((tag) => tag.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("karaoke") || text.includes("karokee") || text.includes("music") || text.includes("concert") || text.includes("band") || text.includes("open mic")) return "Live Music";
  if (text.includes("market") || text.includes("yard sale") || text.includes("vendor") || text.includes("fair") || text.includes("makers")) return "Markets";
  if (text.includes("food") || text.includes("drink") || text.includes("pizza") || text.includes("beer") || text.includes("taco")) return "Food & Drink";
  if (text.includes("night") || text.includes("dj") || text.includes("dance")) return "Nightlife";
  if (text.includes("family") || text.includes("kids") || text.includes("park") || text.includes("responders")) return "Family";
  if (text.includes("outdoor") || text.includes("patio") || text.includes("trail")) return "Outdoor";

  return event.tags?.[0]?.name || "Community";
}

function inferTicketClass(type) {
  if (type === "Live Music") return "teal";
  if (type === "Markets" || type === "Food & Drink") return "orange";
  if (type === "Nightlife") return "red";
  if (type === "Family") return "yellow";
  return "teal";
}

function inferImageClass(type) {
  if (type === "Live Music") return "img-music";
  if (type === "Markets" || type === "Food & Drink") return "img-market";
  if (type === "Nightlife") return "img-jazz";
  return "img-outdoor";
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildLiveEvent(event, index) {
  const type = inferEventType(event);
  const city = formatCity(event);
  const tagNames = unique((event.tags || []).map((tag) => tag.name));
  const id = event.id || String(index + 1);
  const title = event.title || "Untitled Event";
  const sub = event.business?.name || event.addressName || event.address || "Local Event";
  const venue = event.addressName || event.address || event.business?.name || "Local Venue";
  const desc = event.description || "Local event details coming soon.";

  return {
    id,
    href: `${ROOT}/${encodeURIComponent(id)}`,
    date: formatEventDate(event.startDate),
    time: formatEventTime(event.startDate),
    title: escapeHtml(title),
    sub: escapeHtml(sub),
    venue: escapeHtml(venue),
    city: escapeHtml(city),
    type: escapeHtml(type),
    category: escapeHtml(type),
    tags: unique([type, ...tagNames]).slice(0, 4).map(escapeHtml),
    ticket: inferTicketClass(type),
    image: inferImageClass(type),
    saved: false,
    saves: 0,
    desc: escapeHtml(desc),
  };
}

async function loadLiveEvents() {
  try {
    const events = await prisma.event.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        addressName: true,
        address: true,
        city: true,
        state: true,
        startDate: true,
        tags: { select: { name: true } },
        business: { select: { name: true } },
      },
    });

    return events.map(buildLiveEvent);
  } catch (error) {
    console.error("[events-target] failed to load live events", error);
    return [];
  }
}

function pickDefaultEvent(events) {
  if (!events.length) return null;

  const cityCounts = new Map();
  for (const event of events) {
    cityCounts.set(event.city, (cityCounts.get(event.city) || 0) + 1);
  }

  const [defaultCity] = Array.from(cityCounts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return String(left[0]).localeCompare(String(right[0]));
  })[0];

  const cityEvents = events.filter((event) => event.city === defaultCity);
  const dateCounts = new Map();
  for (const event of cityEvents) {
    dateCounts.set(event.date, (dateCounts.get(event.date) || 0) + 1);
  }

  const [defaultDate] = Array.from(dateCounts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return String(left[0]).localeCompare(String(right[0]));
  })[0];

  return cityEvents.find((event) => event.date === defaultDate) || cityEvents[0] || events[0];
}

function cityLabel(city) {
  return String(city).replace(/,\s*[A-Z]{2}$/, "");
}

function buildCitiesMarkup(events, defaultCity) {
  const cities = unique(events.map((event) => event.city));
  if (!cities.length) {
    return '<div class="subnav open" id="citiesNav"></div>';
  }

  return `<div class="subnav open" id="citiesNav">
${cities
  .map(
    (city) =>
      `          <button class="sub-item${city === defaultCity ? " active-sub" : ""}" data-city="${city}">${cityLabel(city)}</button>`
  )
  .join("\n")}
        </div>`;
}

function buildCategoriesMarkup(events) {
  const categories = unique(events.map((event) => event.type));
  if (!categories.length) {
    return '<div class="subnav" id="catsNav"></div>';
  }

  return `<div class="subnav" id="catsNav">
${categories
  .map(
    (category) =>
      `          <button class="sub-item" data-filter="${category}">${category}</button>`
  )
  .join("\n")}
        </div>`;
}

function landingPhotoClass(event) {
  if (event.type === "Live Music") return "band";
  if (event.type === "Markets" || event.type === "Food & Drink") return "market";
  if (event.type === "Nightlife") return "jazz";
  return "sunset";
}

function landingTagClass(event) {
  if (event.ticket === "yellow") return "yellow";
  if (event.ticket === "red") return "red";
  return "teal";
}

function landingDateParts(date) {
  const parsed = new Date(`${date}T00:00:00`);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" })
    .format(parsed)
    .toUpperCase();
  const month = new Intl.DateTimeFormat("en-US", { month: "short" })
    .format(parsed)
    .toUpperCase();
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(parsed);

  return { weekday, month, day };
}

function buildLandingEventCardsMarkup(events) {
  if (!events.length) return null;

  return events
    .slice(0, 4)
    .map((event) => {
      const date = landingDateParts(event.date);
      const tags = event.tags
        .filter((tag) => tag !== event.type)
        .slice(0, 2);

      return `            <a class="event-card" href="${event.href}" aria-label="View ${event.title}">
              <div class="event-top"><div class="date-badge ${landingTagClass(event)}"><span class="month">${date.weekday}<br>${date.month}</span><span class="day">${date.day}</span><span class="time">${event.time}</span></div><div class="event-photo ${landingPhotoClass(event)}"></div></div>
              <div class="event-body"><span class="tag ${landingTagClass(event)}">${event.type}</span><h3 class="event-title">${event.title}</h3><p class="meta">⌖ ${event.venue}<br>${event.city}</p><div class="event-bottom"><div class="mini-tags">${tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div><span class="heart">View →</span></div></div>
            </a>`;
    })
    .join("\n");
}

function injectLandingEventLinks(html, events) {
  const cardsMarkup = buildLandingEventCardsMarkup(events);
  if (!cardsMarkup) return html;

  return html
    .replace(
      "</style>",
      `
    .event-card{cursor:pointer;text-decoration:none;color:inherit}
    .event-card:focus{outline:2px solid var(--teal);outline-offset:4px}
  </style>`
    )
    .replace(
      /<div class="event-grid">[\s\S]*?<\/div>\s*<\/div>\s*<\/section>\s*<section class="section vibe-section">/,
      `<div class="event-grid">\n${cardsMarkup}\n          </div>\n        </div>\n      </section>\n\n      <section class="section vibe-section">`
    );
}

function injectDetailLinks(html) {
  return html
    .replace(
      "</style>",
      `
    .event-card,[data-event-row]{cursor:pointer}
    .event-card:focus,[data-event-row]:focus{outline:2px solid var(--teal);outline-offset:3px}
    .detail-link{display:inline-flex;align-items:center;justify-content:center;padding:11px 14px;border-radius:999px;border:1px solid var(--line-soft);background:rgba(55,179,177,.12);color:#d7ffff;font-size:12px;font-weight:900;text-transform:uppercase}
  </style>`
    )
    .replace(
      '<article class="event-card">',
      '<article class="event-card" data-href="${e.href}" role="link" tabindex="0" onclick="if(!event.target.closest(\\\'button,a\\\')) window.location.href=this.dataset.href" onkeydown="if(event.key===\\\'Enter\\\') window.location.href=this.dataset.href">'
    )
    .replace(
      '<button class="tiny-btn">▣ Add to Calendar</button>',
      '<a class="detail-link" href="${e.href}">View Event</a>'
    )
    .replace(
      '<div class="list-row">',
      '<div class="list-row" data-event-row data-href="${e.href}" role="link" tabindex="0" onclick="window.location.href=this.dataset.href" onkeydown="if(event.key===\\\'Enter\\\') window.location.href=this.dataset.href">'
    )
    .replace(
      '<div class="agenda-item">',
      '<div class="agenda-item" data-event-row data-href="${e.href}" role="link" tabindex="0" onclick="if(!event.target.closest(\\\'button,a\\\')) window.location.href=this.dataset.href" onkeydown="if(event.key===\\\'Enter\\\') window.location.href=this.dataset.href">'
    );
}

function injectResultsSidebarLayout(html) {
  const logoSrc = typeof logoImage === "string" ? logoImage : logoImage.src;

  return html
    .replace(
      "<style>",
      `<style>
    @import url('https://fonts.googleapis.com/css2?family=Bungee&display=swap');
    @import url('https://fonts.googleapis.com/icon?family=Material+Icons');`
    )
    .replace(
      "</style>",
      `
    .app{grid-template-columns:316px minmax(0,1fr)}
    .sidebar{
      width:316px;
      padding:2rem;
      gap:0;
    }
    .brand.brand-image-link{
      display:block;
      width:100%;
      margin:0 0 1rem;
      padding:0;
      text-align:center;
    }
    .sidebar-logo-image{
      display:block;
      width:100%;
      max-width:220px;
      height:auto;
      margin:0 auto;
    }
    .nav-stack{
      gap:1.5rem;
      margin-bottom:0;
    }
    .nav-item,
    .sub-item,
    .login-btn,
    .browse-item{
      font-family:'Bungee', Arial, Helvetica, sans-serif;
      letter-spacing:0;
    }
    .nav-item{
      gap:.75rem;
      padding:0;
      min-height:34px;
      border-radius:0;
      color:var(--text);
      font-size:1.125rem;
      line-height:1.1;
      background:transparent;
      outline:0;
    }
    .nav-item:hover,
    .nav-item.active{
      background:transparent;
      outline:0;
    }
    .nav-item:hover .grow,
    .browse-item:hover span:last-child{
      color:var(--paper);
    }
    .icon-bubble{
      width:2rem;
      height:2rem;
      border-radius:999px;
      padding:.25rem;
      border:0;
      background:#241b16;
      color:white;
      box-shadow:none;
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .icon-bubble .material-icons{
      font-size:1.2rem;
      line-height:1;
      color:white;
    }
    .caret{
      margin-left:auto;
      width:.48rem;
      height:.48rem;
      border-right:2px solid currentColor;
      border-bottom:2px solid currentColor;
      transform:rotate(45deg);
      opacity:.55;
      color:var(--muted);
    }
    .nav-item.expanded .caret{
      transform:rotate(225deg);
    }
    .subnav{
      margin-top:-.7rem;
      margin-left:2.5rem;
      padding:.15rem 0 .05rem .75rem;
      border-left:2px solid rgba(245,231,198,.14);
      gap:.1rem;
    }
    .sub-item{
      color:var(--muted);
      font-size:.78rem;
      letter-spacing:.05em;
      padding:.3rem .4rem;
      border-radius:.4rem;
      text-transform:none;
    }
    .sub-item:hover,
    .sub-item.active-sub{
      background:rgba(245,231,198,.07);
      color:var(--paper);
      outline:0;
    }
    .login-btn{
      display:flex;
      align-items:center;
      justify-content:center;
      width:100%;
      min-height:54px;
      margin:0;
      padding:.75rem 1.5rem;
      border-radius:.75rem;
      color:white;
      font-size:1.125rem;
      text-transform:uppercase;
      transform:rotate(-1deg);
      box-shadow:6px 6px 0 #2b211b;
      text-decoration:none;
    }
    .side-divider{
      height:1px;
      margin:1.4rem 0;
      background:rgba(245,231,198,.18);
      flex:0 0 auto;
    }
    .browse-item{
      gap:1rem;
      padding:.25rem 0;
      margin-bottom:1.25rem;
      color:var(--muted);
      font-size:1.1rem;
      line-height:1.1;
      border-radius:0;
    }
    .browse-item:hover{
      background:transparent;
      transform:translateX(2px);
    }
    .browse-bubble{
      width:3.15rem;
      height:3.15rem;
      border-radius:999px;
      border:3px solid #3d2f26;
      box-shadow:0 2px 0 rgba(0,0,0,.3);
      display:flex;
      align-items:center;
      justify-content:center;
      font-family:Arial, Helvetica, sans-serif;
    }
    .browse-bubble .material-icons{
      font-size:1.35rem;
      line-height:1;
      color:white;
    }
    .side-footer{
      margin-top:auto;
      padding:18px 0 0;
      font-size:10px;
      line-height:1.2;
      opacity:.5;
      color:var(--muted);
    }
    @media (max-width:980px){
      .app{grid-template-columns:1fr}
      .sidebar{width:min(316px,86vw)}
      .mobile-brand{
        width:150px;
        height:54px;
        background:url("${logoSrc}") center/contain no-repeat;
        color:transparent;
        text-shadow:none;
        overflow:hidden;
      }
    }
  </style>`
    )
    .replace(
      /<a href="#" class="brand">[\s\S]*?<\/a>/,
      `<a href="/" class="brand brand-image-link" aria-label="Texas Localist home">
        <img src="${logoSrc}" alt="Texas Localist" class="sidebar-logo-image" />
      </a>`
    )
    .replace(
      /<button class="nav-item active">[\s\S]*?<span class="grow">Events<\/span><\/button>/,
      '<button class="nav-item active"><span class="icon-bubble"><span class="material-icons">event</span></span><span class="grow">Events</span></button>'
    )
    .replace(
      /<button class="nav-item expanded" data-accordion="citiesNav">[\s\S]*?<span class="grow">Cities<\/span><span class="caret">[\s\S]*?<\/span><\/button>/,
      '<button class="nav-item expanded" data-accordion="citiesNav"><span class="icon-bubble"><span class="material-icons">location_city</span></span><span class="grow">Cities</span><span class="caret" aria-hidden="true"></span></button>'
    )
    .replace(
      /<button class="nav-item" data-accordion="catsNav">[\s\S]*?<span class="grow">Categories<\/span><span class="caret">[\s\S]*?<\/span><\/button>/,
      '<button class="nav-item" data-accordion="catsNav"><span class="icon-bubble"><span class="material-icons">category</span></span><span class="grow">Categories</span><span class="caret" aria-hidden="true"></span></button>'
    )
    .replace(
      /<button class="nav-item"><span class="icon-bubble">[\s\S]*?<\/span><span class="grow">Add Listing<\/span><\/button>/,
      '<button class="nav-item"><span class="icon-bubble"><span class="material-icons">add_circle_outline</span></span><span class="grow">Add Listing</span></button>'
    )
    .replace(
      /<button class="login-btn">[\s\S]*?<\/button>/,
      '<a class="login-btn" href="/dashboard">Dashboard</a>'
    )
    .replace(
      /<button class="browse-item" data-quick="New">[\s\S]*?<\/button>/,
      '<button class="browse-item" data-quick="New"><span class="browse-bubble bubble-new"><span class="material-icons">fiber_new</span></span> <span>New</span></button>'
    )
    .replace(
      /<button class="browse-item" data-quick="Most Saved">[\s\S]*?<\/button>/,
      '<button class="browse-item" data-quick="Most Saved"><span class="browse-bubble bubble-save"><span class="material-icons">whatshot</span></span> <span>Most Saved</span></button>'
    )
    .replace(
      /<button class="browse-item" data-quick="Saved">[\s\S]*?<\/button>/,
      '<button class="browse-item" data-quick="Saved"><span class="browse-bubble bubble-fav"><span class="material-icons">favorite</span></span> <span>My Favorites</span></button>'
    );
}

function injectLiveResults(html, events) {
  const defaultEvent = pickDefaultEvent(events);
  const defaultDate = defaultEvent?.date || "2026-05-16";
  const defaultCity = defaultEvent?.city || "";
  const [year, month] = defaultDate.split("-").map(Number);
  const categories = unique(events.map((event) => event.type));
  const defaultState = `const state = {
      view:'cards',
      month:new Date(${year || 2026},${Number.isFinite(month) ? month - 1 : 4},1),
      selectedDate:${safeScriptJson(defaultDate)},
      query:'',
      city:${safeScriptJson(defaultCity)},
      filters:new Set([])
    };`;

  return injectDetailLinks(injectResultsSidebarLayout(html))
    .replace(/<div class="subnav open" id="citiesNav">[\s\S]*?<\/div>/, buildCitiesMarkup(events, defaultCity))
    .replace(/<div class="subnav" id="catsNav">[\s\S]*?<\/div>/, buildCategoriesMarkup(events))
    .replace(/<input id="cityInput" type="text" value="[^"]*" \/>/, `<input id="cityInput" type="text" value="${defaultCity}" />`)
    .replace('<option value="All">All Dates</option>', '<option value="All" selected>All Dates</option>')
    .replace(/const state = \{[\s\S]*?\n    \};/, defaultState)
    .replace(/const events = \[[\s\S]*?\n    \];/, `const events = ${safeScriptJson(events)};`)
    .replace(
      /else if\(\[[^\]]*\]\.includes\(f\)\) list = list\.filter\(e => e\.type===f \|\| e\.tags\.includes\(f\)\);/,
      `else if(${safeScriptJson(categories)}.includes(f)) list = list.filter(e => e.type===f || e.tags.includes(f));`
    )
    .replace(/if\(f === 'Tonight'\) list = list\.filter\(e => e\.date === '2026-05-16'\);/, "if(f === 'Tonight') list = list.filter(e => e.date === state.selectedDate);")
    .replace(/else if\(f === 'This Weekend'\) list = list\.filter\(e => \['2026-05-16','2026-05-17','2026-05-18'\]\.includes\(e\.date\)\);/, "else if(f === 'This Weekend') list = list.filter(e => dateObj(e.date) >= dateObj(state.selectedDate) && dateObj(e.date) <= new Date(dateObj(state.selectedDate).getTime() + 2*24*60*60*1000));")
    .replace(/else if\(f === 'Next 7 Days'\) list = list\.filter\(e => dateObj\(e\.date\) >= dateObj\('2026-05-16'\) && dateObj\(e\.date\) <= dateObj\('2026-05-23'\)\);/, "else if(f === 'Next 7 Days') list = list.filter(e => dateObj(e.date) >= dateObj(state.selectedDate) && dateObj(e.date) <= new Date(dateObj(state.selectedDate).getTime() + 7*24*60*60*1000));");
}

function formatLongDate(startDate) {
  if (!startDate) return "Date coming soon";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(startDate));
}

function buildMapUrl(event) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [event.addressName, event.address, event.city, event.state].filter(Boolean).join(", ")
  )}`;
}

function buildCalendarUrl(event) {
  const start = event.startDate ? new Date(event.startDate) : null;
  const end = event.endDate ? new Date(event.endDate) : null;
  const dates =
    start && !Number.isNaN(start.getTime())
      ? `${start.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}/${(end && !Number.isNaN(end.getTime()) ? end : new Date(start.getTime() + 2 * 60 * 60 * 1000)).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`
      : "";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title || "Texas Localist Event",
    details: event.description || "",
    location: [event.addressName, event.address, event.city, event.state].filter(Boolean).join(", "),
  });

  if (dates) params.set("dates", dates);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildEventDetailHtml(event) {
  const type = inferEventType(event);
  const ticket = inferTicketClass(type);
  const image = inferImageClass(type);
  const city = formatCity(event);
  const tags = unique([type, ...(event.tags || []).map((tag) => tag.name)]).slice(0, 6);
  const venue = event.addressName || event.address || event.business?.name || "Local Venue";
  const description = event.description || "Local event details coming soon.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(event.title)} | Texas Localist Events</title>
  <style>
    :root{--bg:#0d0a08;--paper:#f5e7c6;--ink:#2f241d;--line:rgba(245,231,198,.18);--muted:#c3b18f;--teal:#37b3b1;--orange:#f18824;--yellow:#f4ca46;--red:#df5a41}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at top left,rgba(55,179,177,.12),transparent 25%),radial-gradient(circle at top right,rgba(241,136,36,.16),transparent 20%),linear-gradient(180deg,#090705,#0c0907);color:var(--paper);font-family:Arial,Helvetica,sans-serif}a{color:inherit;text-decoration:none}.page{width:min(1120px,calc(100% - 40px));margin:0 auto;padding:30px 0 56px}.top{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:28px}.brand{font-family:Georgia,serif;font-style:italic;font-size:42px;font-weight:900;letter-spacing:-.08em;text-shadow:1px 1px 0 #8f4a39,3px 3px 0 var(--orange),5px 5px 0 rgba(55,179,177,.8)}.back,.btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:999px;background:rgba(245,231,198,.06);padding:12px 16px;font-size:12px;font-weight:900;text-transform:uppercase}.hero{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:22px;align-items:stretch}.panel{border:1px solid var(--line);border-radius:28px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.016));box-shadow:0 18px 42px rgba(0,0,0,.32);overflow:hidden}.main{padding:30px}.eyebrow{color:var(--teal);font-size:13px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.title{margin:10px 0 16px;font-family:Georgia,serif;font-style:italic;font-size:clamp(44px,7vw,78px);line-height:.88;letter-spacing:-.07em}.meta{display:grid;gap:10px;margin:22px 0;color:var(--muted);font-weight:900;line-height:1.45}.copy{color:#ead8b2;font-size:18px;font-weight:800;line-height:1.65;white-space:pre-wrap}.tag-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}.tag{padding:8px 11px;border:1px solid rgba(55,179,177,.25);border-radius:999px;background:rgba(55,179,177,.12);color:#b9eeeb;font-size:11px;font-weight:900;text-transform:uppercase}.ticket{min-height:220px;border-radius:28px 28px 0 0;display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:28px 16px;font-weight:900;text-transform:uppercase}.ticket.teal{background:linear-gradient(180deg,#71d1cb,var(--teal))}.ticket.orange{background:linear-gradient(180deg,#ff9f2e,var(--orange));color:var(--ink)}.ticket.yellow{background:linear-gradient(180deg,#ffe071,var(--yellow));color:var(--ink)}.ticket.red{background:linear-gradient(180deg,#ef7756,var(--red))}.ticket .date{font-size:74px;line-height:.9}.ticket .month{font-size:20px;letter-spacing:.1em}.ticket .time{padding-top:14px;border-top:1px solid rgba(0,0,0,.22);width:72%;text-align:center}.thumb{min-height:220px;background-size:cover;background-position:center}.img-music{background-image:linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.45)),radial-gradient(circle at 50% 30%,rgba(255,208,86,.95),transparent 15%),linear-gradient(135deg,#462211,#21110c 40%,#0f1f26)}.img-market{background-image:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.35)),repeating-linear-gradient(90deg,#ef8d2c 0 12px,#281a12 12px 24px)}.img-jazz{background-image:linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.38)),linear-gradient(135deg,#6d3618,#1a1513 58%,#d6a13b)}.img-outdoor{background-image:linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.32)),linear-gradient(180deg,#5fb4c0,#224d56 45%,#182217)}.side-body{padding:20px;display:grid;gap:12px}.btn.primary{background:rgba(55,179,177,.14);color:#d7ffff;border-color:rgba(55,179,177,.34)}@media(max-width:860px){.hero{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}.page{width:min(100% - 28px,1120px);padding-top:20px}.main{padding:24px}.brand{font-size:34px}}
  </style>
</head>
<body>
  <main class="page">
    <div class="top">
      <a class="brand" href="/">Texas Localist</a>
      <a class="back" href="${RESULTS}">Back to Events</a>
    </div>
    <section class="hero">
      <article class="panel main">
        <div class="eyebrow">${escapeHtml(type)} · ${escapeHtml(city)}</div>
        <h1 class="title">${escapeHtml(event.title)}</h1>
        <div class="meta">
          <div>${escapeHtml(formatLongDate(event.startDate))} · ${escapeHtml(formatEventTime(event.startDate))}</div>
          <div>${escapeHtml(venue)}</div>
          <div>${escapeHtml([event.address, city].filter(Boolean).join(", "))}</div>
        </div>
        <p class="copy">${escapeHtml(description)}</p>
        <div class="tag-row">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
      </article>
      <aside class="panel">
        <div class="ticket ${ticket}">
          <div>
            <div class="month">${escapeHtml(formatLongDate(event.startDate).split(",")[0])}</div>
            <div class="date">${escapeHtml(formatEventDate(event.startDate).split("-")[2] || "")}</div>
          </div>
          <div class="time">${escapeHtml(formatEventTime(event.startDate))}</div>
        </div>
        <div class="thumb ${image}"></div>
        <div class="side-body">
          <a class="btn primary" href="${escapeHtml(buildMapUrl(event))}" target="_blank" rel="noreferrer">Open Map</a>
          <a class="btn" href="${escapeHtml(buildCalendarUrl(event))}" target="_blank" rel="noreferrer">Add to Calendar</a>
        </div>
      </aside>
    </section>
  </main>
</body>
</html>`;
}

export async function getEventsTargetLandingHtml() {
  const [html, events] = await Promise.all([
    getEventTestLandingHtml(),
    loadLiveEvents(),
  ]);

  return injectLandingEventLinks(replaceRoutes(html), events);
}

export async function getEventsTargetResultsHtml() {
  const [html, events] = await Promise.all([
    fs.readFile(RESULTS_TEMPLATE_PATH, "utf8"),
    loadLiveEvents(),
  ]);

  return injectLiveResults(html, events);
}

export async function getEventsTargetEventHtml(id) {
  const event = await prisma.event.findFirst({
    where: { id, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      description: true,
      addressName: true,
      address: true,
      city: true,
      state: true,
      startDate: true,
      endDate: true,
      tags: { select: { name: true } },
      business: { select: { name: true } },
    },
  });

  if (!event) return null;
  return buildEventDetailHtml(event);
}
