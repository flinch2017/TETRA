// ajax-loader.js
document.addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

  const href = link.getAttribute("href");
  if (!href.startsWith("/") || href.startsWith("/api")) return;

  e.preventDefault();
  fetch(href)
    .then(res => res.text())
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const newContent = doc.querySelector("#appContent").innerHTML;

      document.querySelector("#appContent").innerHTML = newContent;

      // Optional: update history
      window.history.pushState({}, "", href);
    });
});
