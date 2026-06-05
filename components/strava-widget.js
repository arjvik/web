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

function calendarState(date, dayActivities, activityDates, commuteDates) {
  if (commuteDates.has(isoDate(date))) {
    return "commute";
  }

  if (dayActivities.length) {
    return "active";
  }

  const previousDay = isoDate(addDays(date, -1));
  return activityDates.has(previousDay) ? "recovery" : "none";
}

function renderCalendar(root, activities, commutes, asOf) {
  const grid = root.querySelector("[data-calendar-grid]");
  const monthRow = root.querySelector("[data-calendar-months]");
  const rangeStart = startOfYear(asOf);
  const calendarStart = startOfWeek(rangeStart);
  const calendarEnd = endOfWeek(asOf);
  const weekCount = Math.round((calendarEnd - calendarStart) / dayMs / 7) + 1;
  const activityMap = new Map();
  const activityDates = new Set(activities.map((activity) => activity.date));
  const commuteDates = new Set(commutes.map((commute) => commute.date));

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
    const hasCommute = inRange && commuteDates.has(currentIso);
    const state = calendarState(date, dayActivities, activityDates, commuteDates);

    cell.className = `calendar-cell ${inRange ? `activity-${state}` : "calendar-outside"} ${
      dayActivities.length ? "cursor-pointer" : ""
    }`;
    cell.dataset.date = currentIso;
    cell.dataset.hasActivity = String(dayActivities.length > 0);
    cell.dataset.hasCommute = String(hasCommute);
    if (dayActivities.length) {
      cell.tabIndex = 0;
    }
    if (inRange) {
      const activityLabel = `${dayActivities.length} activit${dayActivities.length === 1 ? "y" : "ies"}`;
      cell.setAttribute(
        "aria-label",
        dayActivities.length && hasCommute
          ? `${formatDate(currentIso)} - commute and ${activityLabel}`
          : dayActivities.length
          ? `${formatDate(currentIso)} - ${activityLabel}`
          : hasCommute
          ? `${formatDate(currentIso)} - commute`
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

function activityUrl(activity) {
  return `https://www.strava.com/activities/${activity.id}`;
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

function activityMapMarkup(activity, activityIndex) {
  if (!activity.map_polyline) {
    return "";
  }

  const points = decodePolyline(activity.map_polyline);
  if (points.length < 2) {
    return "";
  }

  return `
    <a
      href="${activityUrl(activity)}"
      target="_blank"
      rel="noreferrer"
      aria-label="Open route on Strava"
      class="mt-3 block"
    >
      <div
        data-activity-map="${activityIndex}"
        class="activity-map aspect-[8/5] w-full overflow-hidden rounded"
        aria-label="Route map"
        role="img"
      ></div>
    </a>
  `;
}

function tooltipMarkup(date, activities, pinned) {
  return `
    <div class="mb-3 flex items-center justify-between gap-3">
      <div class="text-xs font-medium uppercase text-muted">${formatDate(date)}</div>
      ${
        pinned
          ? `
            <button
              type="button"
              data-close-tooltip
              aria-label="Close activity details"
              class="text-muted transition hover:text-ink"
            >
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          `
          : ""
      }
    </div>
    <div class="space-y-4">
      ${activities
        .map(
          (activity, activityIndex) => `
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
                          (photo, photoIndex) => `
                            ${
                              pinned
                                ? `
                                  <button
                                    type="button"
                                    data-open-photo="${photoIndex}"
                                    data-photo-activity="${activityIndex}"
                                    aria-label="Open activity photo ${photoIndex + 1}"
                                    class="block overflow-hidden rounded"
                                  >
                                `
                                : ""
                            }
                              <img
                                src="${photo}"
                                alt=""
                                class="aspect-[3/2] w-full rounded object-cover"
                              />
                            ${pinned ? "</button>" : ""}
                          `,
                        )
                        .join("")}
                    </div>
                  `
                  : ""
              }
              ${activityMapMarkup(activity, activityIndex)}
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
      <section class="relative rounded-md border border-line bg-[#fbf8f3] px-4 py-4 shadow-soft sm:rounded-lg sm:px-6">
        <div class="flex items-center justify-between gap-3 border-b border-line pb-3 sm:gap-4">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent text-accent">
              <i data-lucide="mountain" class="h-4 w-4"></i>
            </span>
            <h2 class="min-w-0 truncate font-serif text-base font-medium min-[380px]:text-lg sm:text-[1.35rem]">
              Activity (Strava)
            </h2>
          </div>

          <a
            data-strava-link
            class="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-accent transition hover:text-ink min-[380px]:gap-2 min-[380px]:text-sm"
            href="#"
          >
            <span class="hidden min-[380px]:inline">View on Strava</span>
            <span class="min-[380px]:hidden">Strava</span>
            <i data-lucide="arrow-right" class="h-4 w-4"></i>
          </a>
        </div>

        <div class="activity-layout mt-4">
          <div>
            <p class="text-xs font-medium uppercase text-muted">Activity Calendar</p>
            <div class="mt-3 pb-1">
              <div class="calendar-shell grid grid-cols-[0.75rem_minmax(0,1fr)] gap-2 sm:grid-cols-[1rem_minmax(0,1fr)] sm:gap-3">
                <div class="grid grid-rows-7 gap-[0.16rem] pt-5 text-[0.6rem] uppercase text-muted sm:gap-1 sm:text-[0.65rem]">
                  <span>M</span>
                  <span>T</span>
                  <span>W</span>
                  <span>T</span>
                  <span>F</span>
                  <span>S</span>
                  <span>S</span>
                </div>

                <div class="min-w-0">
                  <div data-calendar-months class="calendar-months mb-2 min-h-3 text-[0.6rem] uppercase text-muted sm:text-[0.65rem]"></div>
                  <div data-calendar-grid class="calendar-grid"></div>
                </div>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-ink sm:mt-5">
              <span class="inline-flex items-center gap-2">
                <span class="h-3 w-3 rounded-sm activity-active"></span>
                Active
              </span>
              <span class="inline-flex items-center gap-2">
                <span class="h-3 w-3 rounded-sm activity-commute"></span>
                Commute
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
          class="pointer-events-none fixed z-20 hidden max-h-[calc(100svh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-72 overflow-y-auto rounded-md border border-line bg-[#fffaf4] p-4 shadow-soft"
        ></div>
      </section>
      <div
        data-photo-lightbox
        class="fixed inset-0 z-40 hidden items-center justify-center bg-ink/95 p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Activity photo viewer"
      >
        <button
          type="button"
          data-close-lightbox
          aria-label="Close photo viewer"
          class="absolute right-3 top-3 text-white/80 transition hover:text-white sm:right-4 sm:top-4"
        >
          <i data-lucide="x" class="h-7 w-7"></i>
        </button>
        <button
          type="button"
          data-lightbox-prev
          aria-label="Previous photo"
          class="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-ink/45 text-white/85 backdrop-blur transition hover:text-white sm:left-4"
        >
          <i data-lucide="chevron-left" class="h-8 w-8"></i>
        </button>
        <img
          data-lightbox-image
          src=""
          alt=""
          class="max-h-[calc(100svh-4rem)] max-w-full rounded-md object-contain sm:max-h-full"
        />
        <button
          type="button"
          data-lightbox-next
          aria-label="Next photo"
          class="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-ink/45 text-white/85 backdrop-blur transition hover:text-white sm:right-4"
        >
          <i data-lucide="chevron-right" class="h-8 w-8"></i>
        </button>
      </div>
    `;

    this.loadActivities();
    this.bindTooltipEvents();
    this.bindLightboxEvents();
    lucide.createIcons();
  }

  async loadActivities() {
    try {
      const [data, commuteData] = await Promise.all([
        this.fetchJsonWithFallback("./activities.json", "./activities.mock.json"),
        this.fetchJsonWithFallback("./commutes.json", "./commutes.mock.json", { optional: true }),
      ]);
      const asOf = localDate(data.asOf);
      const commutes = commuteData?.commutes ?? [];
      this.activities = data.activities;
      this.commutes = commutes;
      this.activitiesByDate = new Map();
      data.activities.forEach((activity) => {
        if (!this.activitiesByDate.has(activity.date)) {
          this.activitiesByDate.set(activity.date, []);
        }
        this.activitiesByDate.get(activity.date).push(activity);
      });
      renderStravaLinks(this, data.profileUrl);
      renderCalendar(this, data.activities, commutes, asOf);
      renderYearSummary(this, data.activities, asOf);
      lucide.createIcons();
    } catch (error) {
      console.error("Unable to load activities", error);
      renderActivityError(this);
    }
  }

  async fetchJsonWithFallback(primaryUrl, fallbackUrl, { optional = false } = {}) {
    let response = await fetch(primaryUrl);
    if (response.status === 404) {
      response = await fetch(fallbackUrl);
    }

    if (!response.ok) {
      if (optional) {
        return null;
      }

      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  bindTooltipEvents() {
    const grid = this.querySelector("[data-calendar-grid]");
    grid.addEventListener("mouseover", (event) => {
      const cell = event.target.closest('[data-has-activity="true"]');
      if (!cell || this.pinnedDate) {
        return;
      }
      this.showTooltip(cell, false);
    });
    grid.addEventListener("focusin", (event) => {
      const cell = event.target.closest('[data-has-activity="true"]');
      if (!cell || this.pinnedDate) {
        return;
      }
      this.showTooltip(cell, false);
    });
    grid.addEventListener("click", (event) => {
      const cell = event.target.closest('[data-has-activity="true"]');
      if (!cell) {
        return;
      }

      event.stopPropagation();
      this.showTooltip(cell, true);
    });
    grid.addEventListener("mouseout", (event) => {
      const previousCell = event.target.closest('[data-has-activity="true"]');
      const nextCell = event.relatedTarget?.closest?.('[data-has-activity="true"]');
      if (previousCell && !nextCell && !this.pinnedDate) {
        this.hideTooltip();
      }
    });
    grid.addEventListener("focusout", (event) => {
      const previousCell = event.target.closest('[data-has-activity="true"]');
      const nextCell = event.relatedTarget?.closest?.('[data-has-activity="true"]');
      if (previousCell && !nextCell && !this.pinnedDate) {
        this.hideTooltip();
      }
    });

    this.querySelector("[data-activity-tooltip]").addEventListener("click", (event) => {
      if (event.target.closest("[data-close-tooltip]")) {
        this.hideTooltip();
        return;
      }

      const photoButton = event.target.closest("[data-open-photo]");
      if (!photoButton) {
        return;
      }

      const activity = this.pinnedActivities?.[Number(photoButton.dataset.photoActivity)];
      if (!activity) {
        return;
      }

      this.openPhotoLightbox(activityPhotos(activity), Number(photoButton.dataset.openPhoto));
    });

    document.addEventListener("click", (event) => {
      if (!this.pinnedDate) {
        return;
      }

      if (this.contains(event.target)) {
        return;
      }

      this.hideTooltip();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (this.lightboxPhotos?.length) {
          this.closePhotoLightbox();
        } else if (this.pinnedDate) {
          this.hideTooltip();
        }
      }
    });
  }

  showTooltip(cell, pinned) {
    const tooltip = this.querySelector("[data-activity-tooltip]");
    const activities = this.activitiesByDate?.get(cell.dataset.date) ?? [];
    if (!activities.length) {
      return;
    }

    this.pinnedDate = pinned ? cell.dataset.date : "";
    this.pinnedActivities = pinned ? activities : [];
    this.clearTooltipMaps();
    tooltip.innerHTML = tooltipMarkup(cell.dataset.date, activities, pinned);
    tooltip.classList.toggle("pointer-events-none", !pinned);
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
    this.renderTooltipMaps(activities);
    lucide.createIcons();
  }

  hideTooltip() {
    this.clearTooltipMaps();
    this.pinnedDate = "";
    this.pinnedActivities = [];
    const tooltip = this.querySelector("[data-activity-tooltip]");
    tooltip.classList.add("hidden", "pointer-events-none");
  }

  renderTooltipMaps(activities) {
    if (!window.L) {
      return;
    }

    activities.forEach((activity, activityIndex) => {
      const container = this.querySelector(`[data-activity-map="${activityIndex}"]`);
      if (!container || !activity.map_polyline) {
        return;
      }

      const points = decodePolyline(activity.map_polyline);
      if (points.length < 2) {
        return;
      }

      const map = L.map(container, {
        attributionControl: true,
        dragging: false,
        keyboard: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        tap: false,
        zoomControl: false,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const route = L.polyline(points, {
        color: "#c94f1d",
        opacity: 0.95,
        weight: 4,
      }).addTo(map);
      map.fitBounds(route.getBounds(), { padding: [18, 18] });
      this.tooltipMaps ??= [];
      this.tooltipMaps.push(map);
    });
  }

  clearTooltipMaps() {
    this.tooltipMaps?.forEach((map) => map.remove());
    this.tooltipMaps = [];
  }

  bindLightboxEvents() {
    const lightbox = this.querySelector("[data-photo-lightbox]");
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox || event.target.closest("[data-close-lightbox]")) {
        this.closePhotoLightbox();
      }
    });
    this.querySelector("[data-lightbox-prev]").addEventListener("click", () => {
      this.showPhotoAt(this.lightboxIndex - 1);
    });
    this.querySelector("[data-lightbox-next]").addEventListener("click", () => {
      this.showPhotoAt(this.lightboxIndex + 1);
    });
  }

  openPhotoLightbox(photos, index) {
    if (!photos.length) {
      return;
    }

    this.lightboxPhotos = photos;
    this.showPhotoAt(index);
    const hasMultiplePhotos = photos.length > 1;
    this.querySelector("[data-lightbox-prev]").classList.toggle("hidden", !hasMultiplePhotos);
    this.querySelector("[data-lightbox-next]").classList.toggle("hidden", !hasMultiplePhotos);
    this.querySelector("[data-photo-lightbox]").classList.remove("hidden");
    this.querySelector("[data-photo-lightbox]").classList.add("flex");
  }

  closePhotoLightbox() {
    this.lightboxPhotos = [];
    const lightbox = this.querySelector("[data-photo-lightbox]");
    lightbox.classList.add("hidden");
    lightbox.classList.remove("flex");
  }

  showPhotoAt(index) {
    if (!this.lightboxPhotos?.length) {
      return;
    }

    this.lightboxIndex = (index + this.lightboxPhotos.length) % this.lightboxPhotos.length;
    this.querySelector("[data-lightbox-image]").src = this.lightboxPhotos[this.lightboxIndex];
  }
}

customElements.define("strava-widget", StravaWidget);
