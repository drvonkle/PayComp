const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const base = "https://www.paycomp.com";
const outDir = process.env.OUT_DIR || "website-rebuild";

const routes = [
  ["/", "index.html"],
  ["/about-us", "about-us.html"],
  ["/our-team", "our-team.html"],
  ["/why-paycomp", "why-paycomp.html"],
  ["/technology", "technology.html"],
  ["/terms-of-use-and-data-privacy", "privacy-security.html"],
  ["/tech-products", "tech-products.html"],
  ["/relay", "relay.html"],
  ["/atlas", "atlas.html"],
  ["/compconnect", "compconnect.html"],
  ["/5-levels-of-carrier-service", "carrier-integration.html"],
  ["/5-levels-of-payroll-provider-integration", "payroll-integration.html"],
  ["/agencies-and-brokers", "agencies-and-brokers.html"],
  ["/mga", "mga.html"],
  ["/insurance-networks", "insurance-networks.html"],
  ["/insurance-carriers", "insurance-carriers.html"],
  ["/payroll-provider", "payroll-provider.html"],
  ["/privacy-policy", "privacy-policy.html"],
  ["/terms-and-conditions", "terms-and-conditions.html"],
  ["/contact", "contact.html"]
];

const routeMap = new Map(routes);
function localHref(href) {
  if (!href) return href;
  if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return href;
  try {
    const u = new URL(href, base);
    if (u.origin !== base) return href;
    const clean = u.pathname.length > 1 ? u.pathname.replace(/\/$/, "") : "/";
    const target = routeMap.get(clean);
    return target ? target + u.hash : href;
  } catch { return href; }
}

fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });

  for (const [route, file] of routes) {
    const page = await context.newPage();
    await page.goto(base + route, { waitUntil: "networkidle", timeout: 90000 });

    // Fully hydrate every lazy-loaded section/image and allow in-view motion to finish.
    await page.evaluate(() => {
      document.querySelectorAll("img").forEach(img => img.loading = "eager");
    });

    let previousHeight = 0;
    for (let pass = 0; pass < 3; pass++) {
      const height = await page.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y <= height; y += 320) {
        await page.evaluate(v => window.scrollTo(0, v), y);
        await page.waitForTimeout(140);
      }
      await page.waitForTimeout(450);
      const nextHeight = await page.evaluate(() => document.body.scrollHeight);
      if (nextHeight === previousHeight) break;
      previousHeight = nextHeight;
    }

    // Wait for all image requests that can complete.
    await page.evaluate(async () => {
      const imgs = [...document.images];
      await Promise.all(imgs.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          setTimeout(done, 5000);
        });
      }));
    });

    // Framer Motion leaves off-screen elements at opacity:0 in the DOM until
    // their IntersectionObserver animation runs. Normalize only content inside
    // main/footer so intentionally hidden header dropdown menus stay hidden.
    await page.evaluate(() => {
      for (const root of [document.querySelector("main"), document.querySelector("footer")]) {
        if (!root) continue;
        root.querySelectorAll("*").forEach(el => {
          const style = getComputedStyle(el);
          if (style.opacity === "0" && style.display !== "none" && style.visibility !== "hidden") {
            el.style.opacity = "1";
            if (el.style.transform) el.style.transform = "none";
            if (el.style.filter) el.style.filter = "none";
          }
        });
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(300);

    const html = await page.evaluate(({ routePairs }) => {
      const routeMap = new Map(routePairs);
      const base = "https://www.paycomp.com";
      const clone = document.documentElement.cloneNode(true);

      clone.querySelectorAll("script").forEach(el => el.remove());
      clone.querySelectorAll("#crisp-chatbox,[data-crisp-client]").forEach(el => el.remove());

      clone.querySelectorAll("link[rel=stylesheet]").forEach(el => {
        const href = el.getAttribute("href") || "";
        if (href.includes("/assets/")) el.setAttribute("href", "production.css");
      });

      clone.querySelectorAll("[src]").forEach(el => {
        const src = el.getAttribute("src");
        if (src && src.startsWith("/")) el.setAttribute("src", base + src);
      });
      clone.querySelectorAll("[srcset]").forEach(el => {
        const srcset = el.getAttribute("srcset");
        if (srcset) el.setAttribute("srcset", srcset.split(",").map(p => {
          const bits = p.trim().split(/\s+/);
          if (bits[0].startsWith("/")) bits[0] = base + bits[0];
          return bits.join(" ");
        }).join(", "));
      });

      clone.querySelectorAll("a[href]").forEach(a => {
        const href = a.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
        try {
          const u = new URL(href, base);
          if (u.origin !== base) return;
          const clean = u.pathname.length > 1 ? u.pathname.replace(/\/$/, "") : "/";
          const target = routeMap.get(clean);
          if (target) a.setAttribute("href", target + u.hash);
        } catch {}
      });

      // Remove app-specific hydration metadata and attach static replica helpers.
      clone.querySelectorAll("[data-status]").forEach(el => el.removeAttribute("data-status"));
      const helperCss = document.createElement("link");
      helperCss.rel = "stylesheet";
      helperCss.href = "replica.css";
      clone.querySelector("head").appendChild(helperCss);

      const helperJs = document.createElement("script");
      helperJs.src = "replica.js";
      helperJs.defer = true;
      clone.querySelector("body").appendChild(helperJs);

      return "<!doctype html>\n" + clone.outerHTML;
    }, { routePairs: routes });

    const liveStats = await page.evaluate(() => ({
      sections: document.querySelectorAll("section").length,
      images: document.querySelectorAll("img").length,
      headings: document.querySelectorAll("h1,h2,h3").length,
      bodyChars: document.body.innerText.trim().length
    }));

    const snapshotStats = {
      sections: (html.match(/<section\\b/g) || []).length,
      images: (html.match(/<img\\b/g) || []).length,
      headings: (html.match(/<h[123]\\b/g) || []).length
    };

    if (snapshotStats.sections !== liveStats.sections ||
        snapshotStats.images !== liveStats.images ||
        snapshotStats.headings !== liveStats.headings) {
      throw new Error("Incomplete snapshot for " + route + ": " +
        JSON.stringify({ liveStats, snapshotStats }));
    }

    fs.writeFileSync(path.join(outDir, file), html);
    await page.close();
    console.log("captured", route, "->", file, liveStats);
  }

  const source = await (await fetch(base + "/")).text();
  const cssMatch = source.match(/href="(\/assets\/[^"]+\.css)"/);
  if (!cssMatch) throw new Error("Production CSS asset not found");
  const css = await (await fetch(base + cssMatch[1])).text();
  fs.writeFileSync(path.join(outDir, "production.css"), css);

  fs.writeFileSync(path.join(outDir, "replica.css"), `
/* Small static-snapshot helpers. Production visuals remain in production.css. */
.replica-mobile-menu{display:none}
@media(max-width:1023px){
  .replica-mobile-menu.open{display:block;position:absolute;top:100%;left:0;right:0;background:#fff;border-top:1px solid rgba(12,43,124,.12);box-shadow:0 18px 45px rgba(12,43,124,.12);padding:14px 20px 22px;max-height:78vh;overflow:auto}
  .replica-mobile-menu a{display:block;padding:10px 6px;font-weight:600;text-decoration:none;color:#0c2b7c}
  .replica-mobile-menu .sub{padding-left:18px;font-size:.9rem;opacity:.82}
}
`);

  fs.writeFileSync(path.join(outDir, "replica.js"), `
(() => {
  const header = document.querySelector("header");
  if (!header) return;
  const toggle = header.querySelector("button");
  const desktop = header.querySelector("nav");
  if (toggle && desktop) {
    const menu = document.createElement("div");
    menu.className = "replica-mobile-menu";
    const groups = [...desktop.children];
    menu.innerHTML = groups.map(group => {
      const direct = group.querySelector(":scope > a");
      if (!direct) return "";
      const title = (direct.textContent || "").trim();
      const href = direct.getAttribute("href") || "#";
      const children = [...group.querySelectorAll(":scope > div a")];
      if (!children.length) return '<a href="'+href+'">'+title+'</a>';
      return '<div class="replica-mobile-group"><a href="'+href+'">'+title+'</a>' +
        children.map(a => '<a class="sub" href="'+(a.getAttribute("href")||"#")+'">'+((a.textContent||"").trim())+'</a>').join("") +
        '</div>';
    }).join("");
    header.querySelector(":scope > div")?.appendChild(menu);
    toggle.addEventListener("click", e => {
      e.preventDefault();
      menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", menu.classList.contains("open") ? "true" : "false");
    });
  }
})();
`);

  await browser.close();
})();