// artistSelector.js

export function createArtistSelector({ type, currentUser, onUnknownArtist }) {
  const container = document.createElement('div');
  container.className = `${type}-artist-container`;

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = type === 'primary' ? 'Add Primary Artist*' : 'Add Featured Artist (If any)';
  container.appendChild(input);

  const selectedDiv = document.createElement('div');
  selectedDiv.className = type === 'primary' ? 'selected-artists' : 'selected-featured-artists';
  container.appendChild(selectedDiv);

  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'hidden';
  hiddenInput.name = type === 'primary' ? 'primaryArtistAcodes' : 'featuredArtistAcodes';
  container.appendChild(hiddenInput);

  const selectedMap = new Map();
  if (type === 'primary') {
    selectedMap.set(currentUser, 'You');
  }

  function renderSelected() {
    selectedDiv.innerHTML = '';
    selectedMap.forEach((name, acode) => {
      const span = document.createElement('span');
      span.className = 'artist-capsule';
      span.textContent = name;

      if (type === 'featured' || acode !== currentUser) {
        const x = document.createElement('i');
        x.className = 'fas fa-times remove-artist';
        x.onclick = () => {
          selectedMap.delete(acode);
          renderSelected();
        };
        span.appendChild(x);
      }

      selectedDiv.appendChild(span);
    });

    hiddenInput.value = Array.from(selectedMap.keys()).join(',');
  }

  let dropdown;
  input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (!q) {
      if (dropdown) dropdown.remove();
      return;
    }

    const res = await fetch('/search-artists?q=' + encodeURIComponent(q));
    const list = await res.json();

    if (dropdown) dropdown.remove();
    dropdown = document.createElement('div');
    dropdown.className = 'artist-dropdown';

    let hasResult = false;
    list.forEach(user => {
      const isSelf = user.acode === currentUser;
      const inPrimary = selectedMap.has(user.acode);
      if (type === 'featured' && isSelf) return;

      if (!inPrimary) {
        hasResult = true;
        const item = document.createElement('div');
        item.className = 'artist-item';
        const img = document.createElement('img');
        img.src = user.pfp_url;
        img.alt = user.artist_name;
        img.className = 'artist-avatar';

        const name = document.createElement('span');
        name.textContent = user.artist_name;

        item.appendChild(img);
        item.appendChild(name);
        item.onclick = () => {
          selectedMap.set(user.acode, user.artist_name);
          renderSelected();
          input.value = '';
          dropdown.remove();
        };

        dropdown.appendChild(item);
      }
    });

    if (!hasResult) {
      const noResult = document.createElement('div');
      noResult.className = 'no-results-item';
      noResult.textContent = 'No results found';
      dropdown.appendChild(noResult);
    }

    container.appendChild(dropdown);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (input.value.trim()) {
        input.value = '';
        if (onUnknownArtist) onUnknownArtist();
      }
      if (dropdown) dropdown.remove();
    }, 100);
  });

  renderSelected();

  return container;
}
