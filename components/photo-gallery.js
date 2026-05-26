const galleryItems = [
  {
    src: "./assets/film-01-bridge-walkway.jpg",
    alt: "Black-and-white film photograph of a bridge walkway",
    caption: "Rodeo Beach",
  },
  {
    src: "./assets/film-02-porsche-street.jpg",
    alt: "Black-and-white film photograph of a Porsche on a city street",
    caption: "Sausalito",
  },
  {
    src: "./assets/film-03-row-houses.jpg",
    alt: "Black-and-white film photograph of row houses",
    caption: "Lakeshore, San Francisco",
  },
  {
    src: "./assets/film-04-golden-gate.jpg",
    alt: "Black-and-white film photograph of the Golden Gate Bridge",
    caption: "Marin",
  },
  {
    src: "./assets/film-05-coastal-road.jpg",
    alt: "Black-and-white film photograph of a coastal road",
    caption: "Conzelman Road, Marin",
  },
  {
    src: "./assets/film-06-tunnel-view.jpg",
    alt: "Black-and-white film photograph looking through a tunnel",
    caption: "Battery 129, Marin",
  },
  {
    src: "./assets/film-07-palm-house.jpg",
    alt: "Black-and-white film photograph of a house framed by palm trees",
    caption: "Stanford",
  },
  {
    src: "./assets/film-08-brick-building.jpg",
    alt: "Black-and-white film photograph of a brick building",
    caption: "Roble Hall, Stanford",
  },
  {
    src: "./assets/film-09-stairwell-light.jpg",
    alt: "Black-and-white film photograph of stairwell light trails",
    caption: "Stanford Med School",
  },
];

class PhotoGallery extends HTMLElement {
  constructor() {
    super();
    this.index = 0;
    this.initialized = false;
    this.lightboxOpen = false;
    this.handleDocumentKeydown = (event) => {
      if (!this.lightboxOpen) {
        return;
      }

      if (event.key === "Escape") {
        this.closeLightbox();
      } else if (event.key === "ArrowLeft") {
        this.showLightboxAt(this.lightboxIndex - 1);
      } else if (event.key === "ArrowRight") {
        this.showLightboxAt(this.lightboxIndex + 1);
      }
    };
  }

  connectedCallback() {
    this.innerHTML = `
      <div class="relative mx-auto w-fit max-w-full">
        <button
          type="button"
          data-gallery-prev
          aria-label="Previous photograph"
          class="gallery-nav gallery-nav-prev"
        >
          <i data-lucide="chevron-left" class="h-7 w-7"></i>
        </button>

        <figure class="overflow-hidden rounded-md border border-line shadow-soft">
          <button
            type="button"
            data-open-gallery-lightbox
            aria-label="Open current photograph fullscreen"
            class="block cursor-zoom-in touch-manipulation"
          >
            <img
              data-gallery-hero
              src="${galleryItems[0].src}"
              alt="${galleryItems[0].alt}"
              class="gallery-frame block max-h-[70svh] max-w-full object-contain sm:max-h-[min(70vh,42rem)]"
            />
          </button>
        </figure>

        <button
          type="button"
          data-gallery-next
          aria-label="Next photograph"
          class="gallery-nav gallery-nav-next"
        >
          <i data-lucide="chevron-right" class="h-7 w-7"></i>
        </button>
      </div>

      <p class="mt-2 text-right text-[0.68rem] tracking-[0.08em] text-muted sm:text-xs">Nikon FE2, 35mm</p>
      <div class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3" data-gallery-thumbnails></div>
      <div class="mt-4 flex items-center justify-center gap-2.5 sm:gap-3" data-gallery-dots aria-label="Gallery pagination"></div>
      <div
        data-gallery-lightbox
        class="fixed inset-0 z-40 hidden items-center justify-center bg-ink/95 p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Photo viewer"
      >
        <button
          type="button"
          data-close-gallery-lightbox
          aria-label="Close photo viewer"
          class="absolute right-3 top-3 text-white/80 transition hover:text-white sm:right-4 sm:top-4"
        >
          <i data-lucide="x" class="h-7 w-7"></i>
        </button>
        <button
          type="button"
          data-gallery-lightbox-prev
          aria-label="Previous photo"
          class="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-ink/45 text-white/85 backdrop-blur transition hover:text-white sm:left-4"
        >
          <i data-lucide="chevron-left" class="h-8 w-8"></i>
        </button>
        <figure class="flex max-h-full max-w-[calc(100vw-1.5rem)] flex-col items-center gap-3 sm:max-w-full">
          <img
            data-gallery-lightbox-image
            src=""
            alt=""
            class="max-h-[calc(100svh-7rem)] max-w-full rounded-md object-contain sm:max-h-[calc(100vh-6rem)]"
          />
          <figcaption
            data-gallery-lightbox-caption
            class="text-center text-sm text-white/75"
          ></figcaption>
        </figure>
        <button
          type="button"
          data-gallery-lightbox-next
          aria-label="Next photo"
          class="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-ink/45 text-white/85 backdrop-blur transition hover:text-white sm:right-4"
        >
          <i data-lucide="chevron-right" class="h-8 w-8"></i>
        </button>
      </div>
    `;

    this.renderControls();
    this.querySelector("[data-gallery-prev]").addEventListener("click", () => this.render(this.index - 1));
    this.querySelector("[data-gallery-next]").addEventListener("click", () => this.render(this.index + 1));
    this.querySelector("[data-open-gallery-lightbox]").addEventListener("click", () => this.openLightbox(this.index));
    this.addEventListener("click", (event) => {
      const galleryButton = event.target.closest("[data-gallery-index]");
      if (!galleryButton) {
        return;
      }

      this.render(Number(galleryButton.dataset.galleryIndex));
    });
    this.bindLightboxEvents();
    document.addEventListener("keydown", this.handleDocumentKeydown);
    this.render(0);
    lucide.createIcons();
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this.handleDocumentKeydown);
  }

  renderControls() {
    this.querySelector("[data-gallery-thumbnails]").innerHTML = galleryItems
      .map(
        (item, index) => `
          <button type="button" data-gallery-index="${index}" aria-label="Show photograph ${index + 1}">
            <img
              src="${item.src}"
              alt=""
              class="aspect-[4/3] w-full rounded border border-transparent object-contain sm:aspect-[5/3]"
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

  bindLightboxEvents() {
    const lightbox = this.querySelector("[data-gallery-lightbox]");

    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox || event.target.closest("[data-close-gallery-lightbox]")) {
        this.closeLightbox();
      }
    });
    this.querySelector("[data-gallery-lightbox-prev]").addEventListener("click", () => {
      this.showLightboxAt(this.lightboxIndex - 1);
    });
    this.querySelector("[data-gallery-lightbox-next]").addEventListener("click", () => {
      this.showLightboxAt(this.lightboxIndex + 1);
    });
  }

  openLightbox(index) {
    this.lightboxOpen = true;
    this.showLightboxAt(index);
    this.querySelector("[data-gallery-lightbox]").classList.remove("hidden");
    this.querySelector("[data-gallery-lightbox]").classList.add("flex");
  }

  closeLightbox() {
    this.lightboxOpen = false;
    const lightbox = this.querySelector("[data-gallery-lightbox]");
    lightbox.classList.add("hidden");
    lightbox.classList.remove("flex");
  }

  showLightboxAt(index) {
    this.lightboxIndex = (index + galleryItems.length) % galleryItems.length;
    const item = galleryItems[this.lightboxIndex];
    const image = this.querySelector("[data-gallery-lightbox-image]");
    const caption = this.querySelector("[data-gallery-lightbox-caption]");

    image.src = item.src;
    image.alt = item.alt;
    caption.textContent = item.caption;
    if (this.index !== this.lightboxIndex) {
      this.render(this.lightboxIndex);
    }
  }
}

customElements.define("photo-gallery", PhotoGallery);
