function bindSearchFormSubmission() {
  document.body.addEventListener('submit', async function (e) {
    const form = e.target.closest('.header-search, #mobileSearchForm');
    if (!form) return;

    e.preventDefault();

    const queryInput = form.querySelector('input[name="q"]');
    if (!queryInput) return;

    const query = queryInput.value.trim();
    if (!query) return;

    const url = `/search?q=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });

      if (!res.ok) throw new Error('Search fetch failed');

      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const newContent = doc.querySelector('#appContent');

      if (newContent) {
        document.querySelector('#appContent').innerHTML = newContent.innerHTML;
        window.history.pushState({}, '', url);
        window.scrollTo(0, 0);
        bindAllPageEvents();
      } else {
        window.location.href = url; // fallback
      }
    } catch (err) {
      console.error('AJAX search failed:', err);
      window.location.href = url;
    }

    const overlay = document.getElementById('mobileSearchOverlay');
    if (overlay) overlay.classList.remove('active');
  });
}