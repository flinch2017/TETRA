// trackOrderManager.js

import Sortable from 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/modular/sortable.esm.js';



export function updateTrackOrder(tracklistContainer, trackOrderInput) {
  if (!tracklistContainer || !trackOrderInput) return;

  const cards = Array.from(tracklistContainer.querySelectorAll('.track-card'));
  if (cards.length === 0) {
    trackOrderInput.value = '';
    return;
  }

  cards.forEach((card, index) => {
    const num = card.querySelector('.track-number');
    if (num) num.textContent = index + 1;
  });

  const order = cards.map(card => {
    const trackIdField = card.querySelector('input[type="hidden"]');
    return trackIdField ? trackIdField.value : '';
  });

  trackOrderInput.value = order.join(',');
}


export function initializeSortable(tracklistContainer, trackOrderInput) {
  if (!tracklistContainer || !trackOrderInput) return;

  return new Sortable(tracklistContainer, {
    handle: '.drag-handle',
    animation: 150,
    onSort: () => updateTrackOrder(tracklistContainer, trackOrderInput)
  });
}

