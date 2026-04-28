const galleryItems = [
  {
    src: "./assets/film1.jpg",
    alt: "Film photograph 1",
  },
  {
    src: "./assets/film2.jpg",
    alt: "Film photograph 2",
  },
  {
    src: "./assets/film3.jpg",
    alt: "Film photograph 3",
  },
];

class PhotoGallery extends HTMLElement {
  constructor() {
    super();
    this.index = 0;
    this.initialized = false;
  }

  connectedCallback() {
    this.innerHTML = `
      <div class="relative">
        <button
          type="button"
          data-gallery-prev
          aria-label="Previous photograph"
          class="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-ink transition hover:text-accent"
        >
          <i data-lucide="chevron-left" class="h-7 w-7"></i>
        </button>

        <figure class="overflow-hidden rounded-md border border-line bg-white/60 shadow-soft">
          <img
            data-gallery-hero
            src="${galleryItems[0].src}"
            alt="${galleryItems[0].alt}"
            class="gallery-frame aspect-[5/2.6] w-full object-cover"
          />
        </figure>

        <button
          type="button"
          data-gallery-next
          aria-label="Next photograph"
          class="absolute right-0 top-1/2 z-10 translate-x-1/2 -translate-y-1/2 text-ink transition hover:text-accent"
        >
          <i data-lucide="chevron-right" class="h-7 w-7"></i>
        </button>
      </div>

      <div class="mt-3 grid grid-cols-5 gap-2 sm:gap-3" data-gallery-thumbnails></div>
      <div class="mt-4 flex items-center justify-center gap-3" data-gallery-dots aria-label="Gallery pagination"></div>
    `;

    this.renderControls();
    this.querySelector("[data-gallery-prev]").addEventListener("click", () => this.render(this.index - 1));
    this.querySelector("[data-gallery-next]").addEventListener("click", () => this.render(this.index + 1));
    this.addEventListener("click", (event) => {
      const galleryButton = event.target.closest("[data-gallery-index]");
      if (!galleryButton) {
        return;
      }

      this.render(Number(galleryButton.dataset.galleryIndex));
    });
    this.render(0);
    lucide.createIcons();
  }

  renderControls() {
    this.querySelector("[data-gallery-thumbnails]").innerHTML = galleryItems
      .map(
        (item, index) => `
          <button type="button" data-gallery-index="${index}" aria-label="Show photograph ${index + 1}">
            <img
              src="${item.src}"
              alt=""
              class="aspect-[5/3] w-full rounded border border-transparent object-cover"
            />
          </button>
        `,
      )
      .join("");

    this.querySelector("[data-gallery-dots]").innerHTML = galleryItems
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

  render(index) {
    this.index = (index + galleryItems.length) % galleryItems.length;
    const hero = this.querySelector("[data-gallery-hero]");
    const thumbnails = this.querySelectorAll("[data-gallery-thumbnails] [data-gallery-index]");
    const dots = this.querySelectorAll("[data-gallery-dots] [data-gallery-index]");
    const item = galleryItems[this.index];

    if (!this.initialized || hero.src === item.src) {
      hero.src = item.src;
      hero.alt = item.alt;
      this.initialized = true;
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
      const active = Number(button.dataset.galleryIndex) === this.index;
      image.classList.toggle("border-accent", active);
      image.classList.toggle("border-transparent", !active);
    });

    dots.forEach((button) => {
      const active = Number(button.dataset.galleryIndex) === this.index;
      button.classList.toggle("bg-ink", active);
      button.classList.toggle("bg-line", !active);
    });
  }
}

customElements.define("photo-gallery", PhotoGallery);
