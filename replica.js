
(() => {
  const header = document.querySelector("header");
  if (!header) return;
  const toggle = header.querySelector("button");
  const desktop = header.querySelector("nav");
  if (toggle && desktop) {
    const menu = document.createElement("div");
    menu.className = "replica-mobile-menu";
    const links = [...desktop.querySelectorAll("a")];
    menu.innerHTML = links.map(a => {
      const t=(a.textContent||"").trim();
      const h=a.getAttribute("href")||"#";
      return '<a href="'+h+'">'+t+'</a>';
    }).join("");
    header.querySelector(":scope > div")?.appendChild(menu);
    toggle.addEventListener("click", e => {
      e.preventDefault();
      menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", menu.classList.contains("open") ? "true" : "false");
    });
  }
})();
