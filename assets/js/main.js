/* =========================================================
   风华 · FENGHUA — fenghua711150.github.io
   原生 JavaScript，无依赖
   ========================================================= */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.classList.add("js");

  /* ---------------- 主题切换 ---------------- */
  var themeToggle = document.getElementById("themeToggle");
  var themeQuery = window.matchMedia("(prefers-color-scheme: light)");

  function currentTheme() {
    return root.dataset.theme === "light" ? "light" : "dark";
  }

  function applyTheme(theme, persist) {
    root.dataset.theme = theme;
    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        theme === "dark" ? "切换到浅色主题" : "切换到深色主题"
      );
    }
    if (persist) {
      try { localStorage.setItem("fh-theme", theme); } catch (e) { /* 忽略 */ }
    }
  }

  applyTheme(currentTheme(), false);

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
    });
  }

  // 未手动选择时，跟随系统主题变化
  if (typeof themeQuery.addEventListener === "function") {
    themeQuery.addEventListener("change", function (event) {
      var saved = null;
      try { saved = localStorage.getItem("fh-theme"); } catch (e) { /* 忽略 */ }
      if (!saved) applyTheme(event.matches ? "light" : "dark", false);
    });
  }

  /* ---------------- 页头滚动态 ---------------- */
  var header = document.querySelector(".header");
  var ticking = false;

  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
    // 回到首屏时取消导航高亮，避免停留在最后一个版块
    if (navLinks && window.scrollY < 120) setActive("");
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();

  /* ---------------- 移动端菜单 ---------------- */
  var menuToggle = document.getElementById("menuToggle");
  var nav = document.getElementById("nav");

  function closeMenu() {
    if (!nav || !menuToggle) return;
    nav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "打开菜单");
  }

  if (menuToggle && nav) {
    menuToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("click", function (event) {
      if (!nav.classList.contains("is-open")) return;
      if (nav.contains(event.target) || menuToggle.contains(event.target)) return;
      closeMenu();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 820) closeMenu();
    });
  }

  /* ---------------- 导航高亮（滚动监听） ---------------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav__link"));
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute("href");
      return id && id.length > 1 ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  function setActive(id) {
    navLinks.forEach(function (link) {
      var active = link.getAttribute("href") === "#" + id;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }

  if (sections.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(
      function (entries) {
        var visible = entries
          .filter(function (entry) { return entry.isIntersecting; })
          .sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; });
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5] }
    );
    sections.forEach(function (section) { spy.observe(section); });
  }

  /* ---------------- 滚动入场 ---------------- */
  var revealItems = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  if (!reduceMotion && "IntersectionObserver" in window) {
    var revealer = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var siblings = el.parentElement
            ? Array.prototype.slice.call(el.parentElement.children).filter(function (child) {
                return child.classList && child.classList.contains("reveal");
              })
            : [];
          var index = Math.max(0, siblings.indexOf(el));
          el.style.setProperty("--delay", Math.min(index * 70, 350) + "ms");
          el.classList.add("is-visible");
          observer.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    revealItems.forEach(function (el) { revealer.observe(el); });
  } else {
    revealItems.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------------- 数字滚动 ---------------- */
  var counters = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));

  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (reduceMotion) {
      el.textContent = String(target);
      return;
    }
    var duration = 1500;
    var start = null;

    function step(timestamp) {
      if (start === null) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(target * eased));
      if (progress < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  if (counters.length) {
    if ("IntersectionObserver" in window) {
      var countObserver = new IntersectionObserver(
        function (entries, observer) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            animateCount(entry.target);
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.6 }
      );
      counters.forEach(function (el) { countObserver.observe(el); });
    } else {
      counters.forEach(animateCount);
    }
  }

  /* ---------------- 打字机 ---------------- */
  var typed = document.getElementById("typed");
  var roles = ["全栈开发者", "界面设计爱好者", "独立创作者", "终身学习者"];

  if (typed) {
    if (reduceMotion) {
      typed.textContent = roles[0];
    } else {
      var roleIndex = 0;
      var charIndex = 0;
      var deleting = false;

      var tick = function () {
        var word = roles[roleIndex];
        charIndex += deleting ? -1 : 1;
        typed.textContent = word.slice(0, charIndex);

        var wait = deleting ? 45 : 110;

        if (!deleting && charIndex === word.length) {
          deleting = true;
          wait = 1900;
        } else if (deleting && charIndex === 0) {
          deleting = false;
          roleIndex = (roleIndex + 1) % roles.length;
          wait = 420;
        }
        window.setTimeout(tick, wait);
      };

      window.setTimeout(tick, 900);
    }
  }

  /* ---------------- 复制邮箱 ---------------- */
  var copyBtn = document.getElementById("copyEmail");
  var toast = document.getElementById("toast");
  var toastTimer = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2200);
  }

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var email = copyBtn.getAttribute("data-email") || "";
      if (!email) return;

      var done = function (ok) {
        showToast(ok ? "邮箱已复制：" + email : "复制失败，请手动选择邮箱");
      };

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(email).then(function () {
          done(true);
        }, function () {
          done(fallbackCopy(email));
        });
      } else {
        done(fallbackCopy(email));
      }
    });
  }

  /* ---------------- 技能卡片光斑跟随 ---------------- */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".skill-card").forEach(function (card) {
      card.addEventListener("pointermove", function (event) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", (event.clientX - rect.left) + "px");
        card.style.setProperty("--my", (event.clientY - rect.top) + "px");
      });
    });
  }

  /* ---------------- 页脚年份 ---------------- */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
