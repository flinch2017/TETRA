// NEW FUNCTION
function bindHorizontalScrollArrows() {
  document.querySelectorAll('.scroll-wrapperx').forEach(wrapper => {
    const scrollBox = wrapper.querySelector('.horizontal-scroll');
    const leftBtn = wrapper.querySelector('.scroll-arrow.left');
    const rightBtn = wrapper.querySelector('.scroll-arrow.right');

    if (!scrollBox || !leftBtn || !rightBtn) return; // Safety check

    const updateArrows = () => {
      leftBtn.style.display = scrollBox.scrollLeft > 0 ? 'block' : 'none';
      rightBtn.style.display =
        scrollBox.scrollLeft + scrollBox.clientWidth < scrollBox.scrollWidth
          ? 'block'
          : 'none';
    };

    const scrollAmount = scrollBox.clientWidth * 0.8; // almost a full view

    [leftBtn, rightBtn].forEach(btn => {
      btn.addEventListener('click', () => {
        const amount = btn.dataset.scroll === 'left' ? -scrollAmount : scrollAmount;
        scrollBox.scrollBy({ left: amount, behavior: 'smooth' });
      });
    });

    scrollBox.addEventListener('scroll', updateArrows);
    window.addEventListener('resize', updateArrows);
    updateArrows();
  });
}