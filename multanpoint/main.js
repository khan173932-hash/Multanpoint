/* =========================================================================
   MULTANPOINT — Homepage interactions
   GSAP + ScrollTrigger + Lenis + SplitType
   All effects are guarded for reduced-motion and touch / low-power devices.
   ========================================================================= */
(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  // Low-power heuristic: weak GPUs choke on blur + scroll-scrub. Detect & lighten.
  const cores = navigator.hardwareConcurrency || 8;
  const mem = navigator.deviceMemory || 8;
  const lowPower = isTouch || cores <= 4 || mem <= 4;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from((c || document).querySelectorAll(s));

  const hasGSAP = typeof window.gsap !== "undefined";
  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------------------
     1. LENIS SMOOTH SCROLL  (synced to GSAP ScrollTrigger)
  --------------------------------------------------------------------- */
  let lenis = null;
  function initLenis() {
    if (prefersReduced || typeof window.Lenis === "undefined") return;
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on("scroll", () => { if (window.ScrollTrigger) ScrollTrigger.update(); });
    if (hasGSAP) {
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  function scrollTo(target) {
    if (lenis) lenis.scrollTo(target, { offset: -80 });
    else { const el = typeof target === "string" ? $(target) : target; el && el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth" }); }
  }

  /* ---------------------------------------------------------------------
     2. PAGE LOADER
  --------------------------------------------------------------------- */
  function runLoader(done) {
    const loader = $("#loader");
    if (!loader) return done();
    const fill = $(".loader__fill", loader);
    const pct  = $(".loader__pct", loader);
    const marks = $$(".loader__mark span", loader);
    const orn = $(".loader__orn", loader);
    const tag = $(".loader__tag", loader);

    // Run done() exactly once, however we get there (timeline complete OR safety timeout).
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      loader.style.display = "none";
      document.body.classList.remove("is-locked");
      done();
    };

    if (prefersReduced || !hasGSAP) return finish();

    document.body.classList.add("is-locked");

    const tl = gsap.timeline({ onComplete: finish });
    tl.to(marks, { y: 0, duration: 0.8, ease: "power4.out", stagger: 0.08 })
      .to(orn, { opacity: 1, duration: 0.5, ease: "power2.out" }, "-=0.3")
      .to(tag, { opacity: 1, duration: 0.5 }, "-=0.35")
      .to({ v: 0 }, { v: 100, duration: 1.5, ease: "power2.inOut",
            onUpdate: function () { const n = Math.round(this.targets()[0].v); fill.style.width = n + "%"; pct.textContent = n + "%"; } }, "-=0.5")
      .to(".loader__inner", { y: -30, opacity: 0, duration: 0.5, ease: "power2.in" }, "+=0.15")
      .to(loader, { yPercent: -100, duration: 0.9, ease: "power4.inOut" }, "-=0.2");

    // Safety net: if the rAF ticker is throttled (e.g. background tab) and the
    // timeline stalls, reveal the page anyway so the user is never trapped.
    setTimeout(finish, 5200);
  }

  /* ---------------------------------------------------------------------
     3. CUSTOM CURSOR + MAGNETIC
  --------------------------------------------------------------------- */
  function initCursor() {
    if (isTouch || prefersReduced) return;
    const dot = $(".cursor-dot"), ring = $(".cursor-ring");
    if (!dot || !ring) return;
    document.body.classList.add("has-cursor");

    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    window.addEventListener("mousemove", e => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`; });
    const loop = () => { rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18; ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`; requestAnimationFrame(loop); };
    loop();

    $$("a, button, [data-cursor], .card, .magnetic").forEach(el => {
      el.addEventListener("mouseenter", () => ring.classList.add("is-active"));
      el.addEventListener("mouseleave", () => ring.classList.remove("is-active"));
    });
    window.addEventListener("mousedown", () => ring.classList.add("is-down"));
    window.addEventListener("mouseup", () => ring.classList.remove("is-down"));

    // Magnetic pull
    $$(".magnetic").forEach(el => {
      const strength = parseFloat(el.dataset.magnetic || "0.35");
      el.addEventListener("mousemove", e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * strength;
        const y = (e.clientY - r.top - r.height / 2) * strength;
        el.style.transform = `translate(${x}px, ${y}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = "translate(0,0)"; });
    });
  }

  /* ---------------------------------------------------------------------
     4. NAVBAR / DRAWER / SEARCH
  --------------------------------------------------------------------- */
  function initNav() {
    const nav = $("#nav");
    const onScroll = () => { nav.classList.toggle("is-stuck", window.scrollY > 20); };
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });

    // Smooth in-page links
    $$('a[data-scroll]').forEach(a => a.addEventListener("click", e => {
      const id = a.getAttribute("href");
      if (id && id.startsWith("#") && $(id)) { e.preventDefault(); scrollTo(id); closeDrawer(); }
    }));

    // Drawer
    const drawer = $("#drawer");
    const openDrawer = () => { drawer.classList.add("is-open"); document.body.classList.add("is-locked"); };
    function closeDrawer() { drawer && drawer.classList.remove("is-open"); document.body.classList.remove("is-locked"); }
    $("#burger") && $("#burger").addEventListener("click", openDrawer);
    $("#drawerClose") && $("#drawerClose").addEventListener("click", closeDrawer);
    $(".drawer__scrim") && $(".drawer__scrim").addEventListener("click", closeDrawer);

    // Search overlay
    const sv = $("#search");
    const openSearch = () => { sv.classList.add("is-open"); document.body.classList.add("is-locked"); setTimeout(() => $("#searchInput") && $("#searchInput").focus(), 250); };
    const closeSearch = () => { sv.classList.remove("is-open"); document.body.classList.remove("is-locked"); };
    $$("[data-search-open]").forEach(b => b.addEventListener("click", openSearch));
    $("#searchClose") && $("#searchClose").addEventListener("click", closeSearch);
    document.addEventListener("keydown", e => { if (e.key === "Escape") { closeSearch(); closeDrawer(); } });
    sv && sv.addEventListener("click", e => { if (e.target === sv) closeSearch(); });
    $("#searchForm") && $("#searchForm").addEventListener("submit", e => { e.preventDefault(); closeSearch(); toast("Search is coming online soon ✦"); });
  }

  /* ---------------------------------------------------------------------
     5. SCROLL PROGRESS + BACK TO TOP + WHATSAPP FLOAT
  --------------------------------------------------------------------- */
  function initProgress() {
    const bar = $("#progress"), top = $("#toTop"), wa = $("#waFloat");
    const update = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      const p = h > 0 ? window.scrollY / h : 0;
      bar.style.transform = `scaleX(${p})`;
      top.classList.toggle("is-visible", window.scrollY > innerHeight * 0.6);
      if (wa) wa.classList.toggle("is-visible", window.scrollY > innerHeight * 0.35);
    };
    update(); window.addEventListener("scroll", update, { passive: true });
    top.addEventListener("click", () => scrollTo(0));
  }

  /* ---------------------------------------------------------------------
     6. HERO ANIMATIONS
  --------------------------------------------------------------------- */
  function initHero() {
    if (!hasGSAP) return;
    const heroTitleSpans = $$(".hero__title .line > span");
    const tl = gsap.timeline({ delay: 0.1 });
    tl.from(".nav", { y: -30, opacity: 0, duration: 0.8, ease: "power3.out" })
      .from(".hero__badge", { y: 20, opacity: 0, duration: 0.6, ease: "power3.out" }, "-=0.4")
      .from(heroTitleSpans, { yPercent: 115, duration: 1, ease: "power4.out", stagger: 0.08 }, "-=0.3")
      .from(".hero__lead", { y: 24, opacity: 0, duration: 0.7, ease: "power3.out" }, "-=0.6")
      .from(".hero__cta > *", { y: 24, opacity: 0, duration: 0.6, ease: "power3.out", stagger: 0.1 }, "-=0.5")
      .from(".hero__trust .pill", { y: 16, opacity: 0, duration: 0.5, stagger: 0.08 }, "-=0.4")
      .from(".hero__fruit", { scale: 0.6, opacity: 0, duration: 1.1, ease: "power4.out" }, "-=1.1")
      .from(".hero__ring", { scale: 0.4, opacity: 0, duration: 1, ease: "power3.out" }, "-=1.0")
      .from(".float-mango, .float-leaf", { scale: 0, opacity: 0, duration: 0.8, ease: "back.out(1.6)", stagger: 0.1 }, "-=0.7")
      .from(".hero__ghost", { opacity: 0, scale: 1.1, duration: 1.2, ease: "power2.out" }, "-=1.2");

    // Skip all continuous loops / scroll-scrub / mouse-parallax on weak devices.
    if (prefersReduced || lowPower) return;

    // Slow rotation of the gold crest ring
    gsap.to(".hero__ring", { rotation: 360, duration: 60, ease: "none", repeat: -1 });

    // Gentle endless float loops
    gsap.to(".hero__fruit", { y: "+=16", duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
    $$(".float-mango").forEach((m, i) => {
      gsap.to(m, { y: (i % 2 ? "+=22" : "-=22"), rotation: i % 2 ? 8 : -8, duration: 3 + i * 0.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
    });
    $$(".float-leaf").forEach((l, i) => gsap.to(l, { rotation: i % 2 ? 12 : -12, duration: 4 + i, ease: "sine.inOut", yoyo: true, repeat: -1 }));

    // Scroll parallax: glass/text drift + ghost word
    gsap.to(".hero__fruit", { yPercent: 26, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.to(".hero__ghost", { yPercent: -18, xPercent: -4, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.to(".hero__copy", { yPercent: -12, opacity: 0.2, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.to(".float-mango.m1", { yPercent: 60, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.to(".float-mango.m2", { yPercent: -50, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

    // Mouse parallax on hero visual
    if (!isTouch) {
      const visual = $(".hero__visual");
      visual && visual.addEventListener("mousemove", e => {
        const r = visual.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(".hero__fruit", { x: px * 26, rotationY: px * 10, duration: 0.6 });
        gsap.to(".float-mango.m1", { x: px * 46, y: py * 36, duration: 0.8 });
        gsap.to(".float-mango.m2", { x: px * -40, y: py * 30, duration: 0.8 });
        gsap.to(".float-mango.m3", { x: px * 34, y: py * -28, duration: 0.8 });
      });
    }

    // Blob drift
    $$(".bg-blob").forEach((b, i) => gsap.to(b, { x: i % 2 ? 60 : -60, y: i % 2 ? -40 : 50, duration: 12 + i * 3, ease: "sine.inOut", yoyo: true, repeat: -1 }));
  }

  /* ---------------------------------------------------------------------
     7. SCROLL REVEALS (sections, cards, split titles)
  --------------------------------------------------------------------- */
  function initReveals() {
    if (!("IntersectionObserver" in window)) return; // CSS leaves content visible

    document.documentElement.classList.add("reveal-ready");

    const reveal = el => el.classList.add("is-in");
    const single = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => { if (e.isIntersecting) { reveal(e.target); obs.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

    // Staggered groups: cascade children in when the group scrolls into view
    const grouped = new Set();
    const groupObs = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        $$("[data-reveal-item]", e.target).forEach((k, i) => setTimeout(() => reveal(k), i * 90));
        obs.unobserve(e.target);
      });
    }, { threshold: 0.1 });
    $$("[data-reveal-group]").forEach(g => { groupObs.observe(g); $$("[data-reveal-item]", g).forEach(k => grouped.add(k)); });

    // Standalone reveals (and any item not owned by a group)
    $$("[data-reveal]").forEach(el => single.observe(el));
    $$("[data-reveal-item]").forEach(el => { if (!grouped.has(el)) single.observe(el); });

    // Split-text headline flourish — pure enhancement, only when everything's available
    if (typeof window.SplitType !== "undefined" && !prefersReduced && hasGSAP) {
      $$("[data-split]").forEach(el => {
        const split = new SplitType(el, { types: "words" });
        gsap.set(split.words, { yPercent: 115, opacity: 0 });
        const sObs = new IntersectionObserver((entries, obs) => {
          entries.forEach(e => {
            if (!e.isIntersecting) return;
            gsap.to(split.words, { yPercent: 0, opacity: 1, duration: 0.9, ease: "power4.out", stagger: 0.04 });
            obs.unobserve(e.target);
          });
        }, { threshold: 0.2 });
        sObs.observe(el);
      });
    }
  }

  /* ---------------------------------------------------------------------
     8. ANIMATED COUNTERS
  --------------------------------------------------------------------- */
  function initCounters() {
    $$("[data-count]").forEach(el => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      const dec = el.dataset.decimals ? parseInt(el.dataset.decimals) : 0;
      const render = v => { el.textContent = (dec ? v.toFixed(dec) : Math.round(v)).toLocaleString() + suffix; };
      render(0);
      if (!hasGSAP) { render(target); return; }
      const obj = { v: 0 };
      ScrollTrigger.create({ trigger: el, start: "top 90%", once: true,
        onEnter: () => gsap.to(obj, { v: target, duration: 2, ease: "power2.out", onUpdate: () => render(obj.v) }) });
    });
  }

  /* ---------------------------------------------------------------------
     9. SEASON COUNTDOWN
  --------------------------------------------------------------------- */
  function initCountdown() {
    const root = $("#countdown");
    if (!root) return;
    const target = new Date(root.dataset.target || "2026-09-30T23:59:59").getTime();
    const elD = $("#cd-d"), elH = $("#cd-h"), elM = $("#cd-m"), elS = $("#cd-s");
    const pad = n => String(n).padStart(2, "0");
    const tick = () => {
      let diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 864e5); diff -= d * 864e5;
      const h = Math.floor(diff / 36e5); diff -= h * 36e5;
      const m = Math.floor(diff / 6e4); diff -= m * 6e4;
      const s = Math.floor(diff / 1e3);
      elD.textContent = pad(d); elH.textContent = pad(h); elM.textContent = pad(m); elS.textContent = pad(s);
    };
    tick(); setInterval(tick, 1000);
  }

  /* ---------------------------------------------------------------------
     10. GALLERY HORIZONTAL SCROLL
  --------------------------------------------------------------------- */
  function initGallery() {
    const section = $("#gallery"), track = $("#galleryTrack");
    if (!section || !track) return;
    // Pinned horizontal scroll only on capable desktops; elsewhere fall back to
    // a native swipe-scroll strip so every card stays reachable (and cheap).
    if (!hasGSAP || isTouch || lowPower) { section.classList.add("is-native-scroll"); return; }
    const getDistance = () => track.scrollWidth - innerWidth + 48;
    gsap.to(track, {
      x: () => -getDistance(), ease: "none",
      scrollTrigger: { trigger: section, start: "top top", end: () => "+=" + getDistance(), scrub: 1, pin: true, invalidateOnRefresh: true }
    });
  }

  /* ---------------------------------------------------------------------
     11. REVIEWS AUTO-SLIDER (seamless marquee, pause on hover)
  --------------------------------------------------------------------- */
  function initReviews() {
    const track = $("#reviewsTrack");
    if (!track) return;
    track.innerHTML += track.innerHTML; // duplicate for loop
    if (prefersReduced) return;
    let x = 0, paused = false, speed = 0.5;
    const half = () => track.scrollWidth / 2;
    track.addEventListener("mouseenter", () => paused = true);
    track.addEventListener("mouseleave", () => paused = false);
    const loop = () => { if (!paused) { x -= speed; if (Math.abs(x) >= half()) x = 0; track.style.transform = `translateX(${x}px)`; } requestAnimationFrame(loop); };
    loop();
  }

  /* ---------------------------------------------------------------------
     12. FAQ ACCORDION
  --------------------------------------------------------------------- */
  function initFaq() {
    $$(".faq__item").forEach(item => {
      const q = $(".faq__q", item), a = $(".faq__a", item);
      q.addEventListener("click", () => {
        const open = item.classList.contains("is-open");
        $$(".faq__item").forEach(o => { o.classList.remove("is-open"); $(".faq__a", o).style.maxHeight = null; });
        if (!open) { item.classList.add("is-open"); a.style.maxHeight = a.scrollHeight + "px"; }
      });
    });
  }

  /* ---------------------------------------------------------------------
     13. CART / WISHLIST / TOASTS
  --------------------------------------------------------------------- */
  let cartCount = 0;
  function toast(msg) {
    const wrap = $("#toasts");
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>${msg}</span>`;
    wrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add("is-in"));
    setTimeout(() => { t.classList.remove("is-in"); setTimeout(() => t.remove(), 500); }, 3200);
  }
  function initCommerce() {
    const badge = $("#cartBadge");
    $$("[data-add]").forEach(btn => btn.addEventListener("click", () => {
      cartCount++; if (badge) { badge.textContent = cartCount; badge.style.display = "grid"; gsap && gsap.fromTo(badge, { scale: 0.4 }, { scale: 1, duration: 0.4, ease: "back.out(2)" }); }
      toast(`Added ${btn.dataset.add} to your basket`);
    }));
    $$("[data-quick]").forEach(btn => btn.addEventListener("click", () => toast(`Quick view: ${btn.dataset.quick} — full page in Step 4`)));
    $$(".card__wish").forEach(btn => btn.addEventListener("click", () => {
      btn.classList.toggle("is-on");
      toast(btn.classList.contains("is-on") ? "Saved to wishlist ♥" : "Removed from wishlist");
    }));
    $$("[data-newsletter]").forEach(form => form.addEventListener("submit", e => {
      e.preventDefault(); const input = $("input", form); if (input) input.value = "";
      toast("You're on the list — fresh harvest news incoming ✦");
    }));
  }

  /* ---------------------------------------------------------------------
     INIT
  --------------------------------------------------------------------- */
  window.addEventListener("DOMContentLoaded", () => {
    if (lowPower) document.body.classList.add("perf-lite");
    initLenis();
    initCursor();
    initNav();
    initProgress();
    initCounters();
    initCountdown();
    initFaq();
    initCommerce();
    initReviews();

    runLoader(() => {
      initHero();
      initReveals();
      initGallery();
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  });

  window.addEventListener("load", () => { if (window.ScrollTrigger) ScrollTrigger.refresh(); });
})();
