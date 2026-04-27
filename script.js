const galleryItems = [
  {
    src: "https://picsum.photos/seed/film-street-01/1200/720?grayscale",
    alt: "Rainy city street in black and white",
  },
  {
    src: "https://picsum.photos/seed/film-benches-02/1200/720?grayscale",
    alt: "Park benches in black and white",
  },
  {
    src: "https://picsum.photos/seed/film-crosswalk-03/1200/720?grayscale",
    alt: "Crosswalk scene in black and white",
  },
  {
    src: "https://picsum.photos/seed/film-window-04/1200/720?grayscale",
    alt: "Person by a window in black and white",
  },
  {
    src: "https://picsum.photos/seed/film-shore-05/1200/720?grayscale",
    alt: "Quiet shoreline in black and white",
  },
];

const dayMs = 24 * 60 * 60 * 1000;
let galleryIndex = 0;
let galleryInitialized = false;

function localDate(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfWeek(date) {
  const copy = new Date(date);
  const mondayOffset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - mondayOffset);
  return copy;
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function formatDistance(value) {
  return `${value.toFixed(1)} km`;
}

function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatElevation(value) {
  return `${Math.round(value)} m`;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(localDate(dateString));
}

function activityIcon(type) {
  return type === "Ride" ? "bike" : "footprints";
}

function renderGalleryControls() {
  const thumbnails = document.querySelector("[data-gallery-thumbnails]");
  const dots = document.querySelector("[data-gallery-dots]");

  thumbnails.innerHTML = galleryItems
    .map(
      (item, index) => `
        <button type="button" data-gallery-index="${index}" aria-label="Show photograph ${index + 1}">
          <img
            src="${item.src.replace("/1200/720", "/400/240")}"
            alt=""
            class="aspect-[5/3] w-full rounded border border-transparent object-cover"
          />
        </button>
      `,
    )
    .join("");

  dots.innerHTML = galleryItems
    .map(
      (_, index) => `
        <button
          class="h-2 w-2 rounded-full bg-line"
          type="button"
          data-gallery-index="${index}"
          aria-label="Go to photograph ${index + 1}"
        ></button>
      `,
    )
    .join("");
}

function renderGallery(index) {
  galleryIndex = (index + galleryItems.length) % galleryItems.length;
  const hero = document.querySelector("[data-gallery-hero]");
  const thumbnails = document.querySelectorAll("[data-gallery-thumbnails] [data-gallery-index]");
  const dots = document.querySelectorAll("[data-gallery-dots] [data-gallery-index]");
  const item = galleryItems[galleryIndex];

  if (!galleryInitialized || hero.src === item.src) {
    hero.src = item.src;
    hero.alt = item.alt;
    galleryInitialized = true;
  } else {
    hero.classList.add("opacity-0");
    window.setTimeout(() => {
      hero.src = item.src;
      hero.alt = item.alt;
      hero.classList.remove("opacity-0");
    }, 90);
  }

  thumbnails.forEach((button) => {
    const image = button.querySelector("img");
    const active = Number(button.dataset.galleryIndex) === galleryIndex;
    image.classList.toggle("border-accent", active);
    image.classList.toggle("border-transparent", !active);
  });

  dots.forEach((button) => {
    const active = Number(button.dataset.galleryIndex) === galleryIndex;
    button.classList.toggle("bg-ink", active);
    button.classList.toggle("bg-line", !active);
  });
}

function renderWeekSummary(activities, asOf) {
  const weekStart = startOfWeek(asOf);
  const weekEnd = endOfWeek(asOf);
  const weekActivities = activities.filter((activity) => {
    const date = localDate(activity.date);
    return date >= weekStart && date <= weekEnd;
  });

  const totals = weekActivities.reduce(
    (accumulator, activity) => {
      accumulator.distance += activity.distance_km;
      accumulator.duration += activity.moving_time_min;
      accumulator.elevation += activity.elevation_m;
      return accumulator;
    },
    { distance: 0, duration: 0, elevation: 0 },
  );

  document.querySelector("[data-week-distance]").textContent = formatDistance(totals.distance);
  document.querySelector("[data-week-time]").textContent = formatDuration(totals.duration);
  document.querySelector("[data-week-elevation]").textContent = formatElevation(totals.elevation);
}

function calendarState(activities) {
  if (!activities.length) {
    return "none";
  }

  const allCommutes = activities.every((activity) => activity.category === "commute");
  if (allCommutes) {
    return "commute";
  }

  const movingTime = activities.reduce((total, activity) => total + activity.moving_time_min, 0);
  const distance = activities.reduce((total, activity) => total + activity.distance_km, 0);
  return movingTime >= 50 || distance >= 12 ? "active" : "recovery";
}

function renderCalendar(activities, asOf) {
  const grid = document.querySelector("[data-calendar-grid]");
  const monthRow = document.querySelector("[data-calendar-months]");
  const rangeStart = addDays(asOf, -364);
  const calendarStart = startOfWeek(rangeStart);
  const calendarEnd = endOfWeek(asOf);
  const activityMap = new Map();

  activities.forEach((activity) => {
    if (!activityMap.has(activity.date)) {
      activityMap.set(activity.date, []);
    }
    activityMap.get(activity.date).push(activity);
  });

  grid.innerHTML = "";
  monthRow.innerHTML = "";

  for (let date = new Date(calendarStart); date <= calendarEnd; date = addDays(date, 1)) {
    const currentIso = isoDate(date);
    const cell = document.createElement("div");
    const inRange = date >= rangeStart && date <= asOf;
    const dayActivities = activityMap.get(currentIso) ?? [];
    const state = calendarState(dayActivities);

    cell.className = `calendar-cell ${inRange ? `activity-${state}` : "calendar-outside"}`;
    cell.title = inRange
      ? dayActivities.length
        ? `${formatDate(currentIso)} - ${dayActivities.length} activit${dayActivities.length === 1 ? "y" : "ies"}`
        : `${formatDate(currentIso)} - no activity`
      : "";
    grid.appendChild(cell);
  }

  const seenMonths = new Set();
  for (let date = new Date(rangeStart); date <= asOf; date = addDays(date, 1)) {
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    if (seenMonths.has(monthKey)) {
      continue;
    }

    seenMonths.add(monthKey);
    const monthsFromStart =
      (date.getFullYear() - rangeStart.getFullYear()) * 12 + date.getMonth() - rangeStart.getMonth();
    if (monthsFromStart % 2 === 1) {
      continue;
    }

    const label = document.createElement("span");
    const weekIndex = Math.floor((date - calendarStart) / dayMs / 7) + 1;
    label.style.gridColumnStart = String(weekIndex);
    label.textContent = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
    monthRow.appendChild(label);
  }
}

function renderRecentActivities(activities) {
  const recentContainer = document.querySelector("[data-recent-activities]");
  const recentActivities = [...activities]
    .sort((a, b) => localDate(b.date) - localDate(a.date))
    .slice(0, 3);

  recentContainer.innerHTML = recentActivities
    .map(
      (activity) => `
        <article class="flex items-start gap-3">
          <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f7e1d6] text-accent">
            <i data-lucide="${activityIcon(activity.type)}" class="h-4 w-4"></i>
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-3">
              <h3 class="truncate text-sm font-medium">${activity.name}</h3>
              <span class="shrink-0 text-sm">${formatDistance(activity.distance_km)}</span>
            </div>
            <div class="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
              <span>${formatDate(activity.date)}</span>
              <span>${formatDuration(activity.moving_time_min)}</span>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderStravaLinks(url) {
  document.querySelectorAll("[data-strava-link]").forEach((link) => {
    link.href = url;
  });
}

function renderActivityError() {
  document.querySelector("[data-calendar-grid]").innerHTML =
    '<p class="col-span-full text-sm text-muted">Activity data could not be loaded.</p>';
}

async function initActivities() {
  try {
    const response = await fetch("./activities.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const asOf = localDate(data.asOf);
    renderStravaLinks(data.profileUrl);
    renderWeekSummary(data.activities, asOf);
    renderCalendar(data.activities, asOf);
    renderRecentActivities(data.activities);
    lucide.createIcons();
  } catch (error) {
    console.error("Unable to load activities", error);
    renderActivityError();
  }
}

document.querySelector("[data-gallery-prev]").addEventListener("click", () => {
  renderGallery(galleryIndex - 1);
});

document.querySelector("[data-gallery-next]").addEventListener("click", () => {
  renderGallery(galleryIndex + 1);
});

renderGalleryControls();
document.addEventListener("click", (event) => {
  const galleryButton = event.target.closest("[data-gallery-index]");
  if (!galleryButton) {
    return;
  }

  renderGallery(Number(galleryButton.dataset.galleryIndex));
});

renderGallery(0);
lucide.createIcons();
initActivities();
