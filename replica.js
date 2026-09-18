
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
