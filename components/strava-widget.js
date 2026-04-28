import {
  addDays,
  dayMs,
  endOfWeek,
  formatDate,
  formatDistance,
  formatDuration,
  isoDate,
  localDate,
  startOfWeek,
  startOfYear,
} from "./strava-utils.js";

const sportMeta = {
  Hike: { icon: "mountain", label: "Hiking" },
  Ride: { icon: "bike", label: "Cycling" },
  Run: { icon: "footprints", label: "Running" },
  Swim: { icon: "waves", label: "Swimming" },
  VirtualRide: { icon: "bike", label: "Cycling" },
  VirtualRun: { icon: "footprints", label: "Running" },
  Walk: { icon: "footprints", label: "Walking" },
  WeightTraining: { icon: "dumbbell", label: "Strength" },
};

function normalizedSport(type) {
  if (type === "VirtualRide") {
    return "Ride";
  }
  if (type === "VirtualRun") {
    return "Run";
  }
  return type;
}

function sportType(activity) {
  return normalizedSport(activity.sport ?? activity.type);
}

function activityIcon(type) {
  return sportMeta[normalizedSport(type)]?.icon ?? "activity";
}

function sportLabel(type) {
  return sportMeta[normalizedSport(type)]?.label ?? type ?? "Activity";
}

function calendarState(date, dayActivities, activityDates) {
  if (dayActivities.length) {
    return "active";
  }

  const previousDay = isoDate(addDays(date, -1));
  return activityDates.has(previousDay) ? "recovery" : "none";
}

function renderCalendar(root, activities, asOf) {
  const grid = root.querySelector("[data-calendar-grid]");
  const monthRow = root.querySelector("[data-calendar-months]");
  const rangeStart = startOfYear(asOf);
  const calendarStart = startOfWeek(rangeStart);
  const calendarEnd = endOfWeek(asOf);
  const weekCount = Math.round((calendarEnd - calendarStart) / dayMs / 7) + 1;
  const activityMap = new Map();
  const activityDates = new Set(activities.map((activity) => activity.date));

  activities.forEach((activity) => {
    if (!activityMap.has(activity.date)) {
      activityMap.set(activity.date, []);
    }
    activityMap.get(activity.date).push(activity);
  });

  grid.innerHTML = "";
  monthRow.innerHTML = "";
  grid.style.gridTemplateColumns = `repeat(${weekCount}, minmax(0, 1fr))`;
  monthRow.style.gridTemplateColumns = `repeat(${weekCount}, minmax(0, 1fr))`;

  for (let date = new Date(calendarStart); date <= calendarEnd; date = addDays(date, 1)) {
    const currentIso = isoDate(date);
    const cell = document.createElement("div");
    const inRange = date >= rangeStart && date <= asOf;
    const dayActivities = inRange ? activityMap.get(currentIso) ?? [] : [];
    const state = calendarState(date, dayActivities, activityDates);

    cell.className = `calendar-cell ${inRange ? `activity-${state}` : "calendar-outside"} ${
      dayActivities.length ? "cursor-pointer" : ""
    }`;
    cell.dataset.date = currentIso;
    cell.dataset.hasActivity = String(dayActivities.length > 0);
    if (dayActivities.length) {
      cell.tabIndex = 0;
    }
    if (inRange) {
      cell.setAttribute(
        "aria-label",
        dayActivities.length
          ? `${formatDate(currentIso)} - ${dayActivities.length} activit${dayActivities.length === 1 ? "y" : "ies"}`
          : `${formatDate(currentIso)} - no activity`,
      );
    }
    grid.appendChild(cell);
  }

  const seenMonths = new Set();
  for (let date = new Date(rangeStart); date <= asOf; date = addDays(date, 1)) {
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    if (seenMonths.has(monthKey)) {
      continue;
    }

    seenMonths.add(monthKey);
    const label = document.createElement("span");
    const weekIndex = Math.floor((date - calendarStart) / dayMs / 7) + 1;
    label.style.gridColumnStart = String(weekIndex);
    label.textContent = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
    monthRow.appendChild(label);
  }
}

function currentYearActivities(activities, asOf) {
  return activities.filter((activity) => localDate(activity.date).getFullYear() === asOf.getFullYear());
}

function calculateWeekStreak(activities, asOf) {
  const activityWeeks = new Set(activities.map((activity) => isoDate(startOfWeek(localDate(activity.date)))));
  const currentWeek = startOfWeek(asOf);
  const hasActivityThisWeek = activityWeeks.has(isoDate(currentWeek));
  const firstWeekToCount = hasActivityThisWeek ? currentWeek : addDays(currentWeek, -7);
  let streak = 0;

  for (let week = firstWeekToCount; activityWeeks.has(isoDate(week)); week = addDays(week, -7)) {
    streak += 1;
  }

  return streak;
}

function calculateMostPopularSport(activities) {
  const counts = activities.reduce((totals, activity) => {
    const type = sportType(activity);
    totals.set(type, (totals.get(type) ?? 0) + 1);
    return totals;
  }, new Map());

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Ride";
}

function renderYearSummary(root, activities, asOf) {
  const yearActivities = currentYearActivities(activities, asOf);
  const totalMiles = yearActivities.reduce((total, activity) => total + activity.distance_km * 0.621371, 0);
  const weekStreak = calculateWeekStreak(yearActivities, asOf);
  const mostPopularSport = calculateMostPopularSport(yearActivities);

  root.querySelector("[data-total-miles]").textContent = `${totalMiles.toFixed(1)} mi`;
  root.querySelector("[data-week-streak]").textContent = `${weekStreak} week${weekStreak === 1 ? "" : "s"}`;
  root.querySelector("[data-popular-sport]").innerHTML = `
    <span class="inline-flex items-center gap-2">
      <i data-lucide="${activityIcon(mostPopularSport)}" class="h-4 w-4 text-accent"></i>
      ${sportLabel(mostPopularSport)}
    </span>
  `;
}

function activityPhotos(activity) {
  return activity.photos ?? [];
}

function decodePolyline(polyline) {
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const points = [];

  while (index < polyline.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = polyline.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;

    do {
      byte = polyline.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([latitude / 1e5, longitude / 1e5]);
  }

  return points;
}

function activityMapSvg(activity) {
  if (!activity.map_polyline) {
    return "";
  }

  const points = decodePolyline(activity.map_polyline);
  if (points.length < 2) {
    return "";
  }

  const latitudes = points.map(([latitude]) => latitude);
  const longitudes = points.map(([, longitude]) => longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeSpan = maxLatitude - minLatitude || 1;
  const longitudeSpan = maxLongitude - minLongitude || 1;
  const path = points
    .map(([latitude, longitude], index) => {
      const x = ((longitude - minLongitude) / longitudeSpan) * 220 + 10;
      const y = 150 - ((latitude - minLatitude) / latitudeSpan) * 130 + 10;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return `
    <svg viewBox="0 0 240 170" role="img" aria-label="Route map" class="mt-3 aspect-[8/5] w-full rounded bg-[#f4ede3]">
      <path d="${path}" fill="none" stroke="#c94f1d" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" />
    </svg>
  `;
}

function tooltipMarkup(date, activities) {
  return `
    <div class="mb-3 text-xs font-medium uppercase text-muted">${formatDate(date)}</div>
    <div class="space-y-4">
      ${activities
        .map(
          (activity) => `
            <article>
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-sm font-medium">${activity.name}</h3>
                  <p class="mt-1 text-xs text-muted">${formatDistance(activity.distance_km)} · ${formatDuration(
                    activity.moving_time_min,
                  )}</p>
                </div>
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f7e1d6] text-accent">
                  <i data-lucide="${activityIcon(sportType(activity))}" class="h-4 w-4"></i>
                </span>
              </div>
              ${
                activityPhotos(activity).length
                  ? `
                    <div class="mt-3 grid grid-cols-2 gap-2">
                      ${activityPhotos(activity)
                        .slice(0, 2)
                        .map(
                          (photo) => `
                            <img
                              src="${photo}"
                              alt=""
                              class="aspect-[3/2] w-full rounded object-cover"
                            />
                          `,
                        )
                        .join("")}
                    </div>
                  `
                  : ""
              }
              ${activityMapSvg(activity)}
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderStravaLinks(root, url) {
  root.querySelectorAll("[data-strava-link]").forEach((link) => {
    link.href = url;
  });
}

function renderActivityError(root) {
  root.querySelector("[data-calendar-grid]").innerHTML =
    '<p class="col-span-full text-sm text-muted">Activity data could not be loaded.</p>';
}

class StravaWidget extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <section class="relative rounded-lg border border-line bg-[#fbf8f3] px-5 py-4 shadow-soft sm:px-6">
        <div class="flex items-center justify-between gap-4 border-b border-line pb-3">
          <div class="flex items-center gap-3">
            <span class="flex h-8 w-8 items-center justify-center rounded-full border border-accent text-accent">
              <i data-lucide="mountain" class="h-4 w-4"></i>
            </span>
            <h2 class="font-serif text-xl font-medium sm:text-[1.35rem]">Activity (Strava)</h2>
          </div>

          <a
            data-strava-link
            class="inline-flex items-center gap-2 text-sm font-medium text-accent transition hover:text-ink"
            href="#"
          >
            View on Strava
            <i data-lucide="arrow-right" class="h-4 w-4"></i>
          </a>
        </div>

        <div class="activity-layout mt-4">
          <div>
            <p class="text-xs font-medium uppercase text-muted">Activity Calendar</p>
            <div class="mt-3 overflow-x-auto pb-1">
              <div class="calendar-shell grid grid-cols-[1rem_minmax(0,1fr)] gap-3">
                <div class="grid grid-rows-7 gap-1 pt-5 text-[0.65rem] uppercase text-muted">
                  <span>M</span>
                  <span>T</span>
                  <span>W</span>
                  <span>T</span>
                  <span>F</span>
                  <span>S</span>
                  <span>S</span>
                </div>

                <div class="min-w-0">
                  <div data-calendar-months class="calendar-months mb-2 min-h-3 text-[0.65rem] uppercase text-muted"></div>
                  <div data-calendar-grid class="calendar-grid"></div>
                </div>
              </div>
            </div>

            <div class="mt-5 flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-ink">
              <span class="inline-flex items-center gap-2">
                <span class="h-3 w-3 rounded-sm activity-active"></span>
                Active
              </span>
            </div>
          </div>

          <div>
            <p class="text-xs font-medium uppercase text-muted">Year To Date</p>
            <dl class="mt-3 space-y-5">
              <div>
                <dt class="text-xs text-muted">Total miles across all sports</dt>
                <dd data-total-miles class="mt-1 font-serif text-2xl">--</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">Week streak</dt>
                <dd data-week-streak class="mt-1 font-serif text-2xl">--</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">Most popular sport</dt>
                <dd data-popular-sport class="mt-2 text-sm font-medium">--</dd>
              </div>
            </dl>
          </div>
        </div>
        <div
          data-activity-tooltip
          class="pointer-events-none fixed z-20 hidden w-72 rounded-md border border-line bg-[#fffaf4] p-4 shadow-soft"
        ></div>
      </section>
    `;

    this.loadActivities();
    this.bindTooltipEvents();
    lucide.createIcons();
  }

  async loadActivities() {
    try {
      let response = await fetch("./activities.json");
      if (response.status === 404) {
        response = await fetch("./activities.mock.json");
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const asOf = localDate(data.asOf);
      this.activities = data.activities;
      this.activitiesByDate = new Map();
      data.activities.forEach((activity) => {
        if (!this.activitiesByDate.has(activity.date)) {
          this.activitiesByDate.set(activity.date, []);
        }
        this.activitiesByDate.get(activity.date).push(activity);
      });
      renderStravaLinks(this, data.profileUrl);
      renderCalendar(this, data.activities, asOf);
      renderYearSummary(this, data.activities, asOf);
      lucide.createIcons();
    } catch (error) {
      console.error("Unable to load activities", error);
      renderActivityError(this);
    }
  }

  bindTooltipEvents() {
    const grid = this.querySelector("[data-calendar-grid]");
    grid.addEventListener("mouseover", (event) => {
      const cell = event.target.closest('[data-has-activity="true"]');
      if (!cell) {
        return;
      }
      this.showTooltip(cell);
    });
    grid.addEventListener("focusin", (event) => {
      const cell = event.target.closest('[data-has-activity="true"]');
      if (!cell) {
        return;
      }
      this.showTooltip(cell);
    });
    grid.addEventListener("mouseout", (event) => {
      const previousCell = event.target.closest('[data-has-activity="true"]');
      const nextCell = event.relatedTarget?.closest?.('[data-has-activity="true"]');
      if (previousCell && !nextCell) {
        this.hideTooltip();
      }
    });
    grid.addEventListener("focusout", (event) => {
      const previousCell = event.target.closest('[data-has-activity="true"]');
      const nextCell = event.relatedTarget?.closest?.('[data-has-activity="true"]');
      if (previousCell && !nextCell) {
        this.hideTooltip();
      }
    });
  }

  showTooltip(cell) {
    const tooltip = this.querySelector("[data-activity-tooltip]");
    const activities = this.activitiesByDate?.get(cell.dataset.date) ?? [];
    if (!activities.length) {
      return;
    }

    tooltip.innerHTML = tooltipMarkup(cell.dataset.date, activities);
    tooltip.classList.remove("hidden");
    const cellRect = cell.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const centeredLeft = cellRect.left + cellRect.width / 2 - tooltipRect.width / 2;
    const clampedLeft = Math.min(Math.max(centeredLeft, 12), window.innerWidth - tooltipRect.width - 12);
    const spaceAbove = cellRect.top - 12;
    const spaceBelow = window.innerHeight - cellRect.bottom - 12;
    const placeAbove = spaceAbove >= tooltipRect.height || spaceAbove >= spaceBelow;
    const preferredTop = placeAbove ? cellRect.top - tooltipRect.height - 12 : cellRect.bottom + 12;
    const clampedTop = Math.min(Math.max(preferredTop, 12), window.innerHeight - tooltipRect.height - 12);

    tooltip.style.left = `${clampedLeft}px`;
    tooltip.style.top = `${clampedTop}px`;
    lucide.createIcons();
  }

  hideTooltip() {
    this.querySelector("[data-activity-tooltip]").classList.add("hidden");
  }
}

customElements.define("strava-widget", StravaWidget);
