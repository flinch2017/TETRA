function bindPostActionButtons() {
  // Like buttons
  document.querySelectorAll('.post-like-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent post click
      const postId = btn.dataset.postId;
      const icon = btn.querySelector('i');
      const isLiked = icon.classList.contains('fa-solid');

      // Optimistic toggle
      icon.classList.toggle('fa-solid', !isLiked);
      icon.classList.toggle('fa-regular', isLiked);

      try {
        const res = await fetch(`/api/posts/${postId}/like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ liked: !isLiked })
        });

        const data = await res.json();
        if (!res.ok || !data.success) throw new Error('Failed to toggle like');
      } catch (err) {
        console.error('Like failed:', err);
        // Revert optimistic update
        icon.classList.toggle('fa-solid', isLiked);
        icon.classList.toggle('fa-regular', !isLiked);
      }
    });
  });

  // Comment buttons
  document.querySelectorAll('.post-comment-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent post click
      const commentBox = btn.closest('.post')?.querySelector('.comment-input-wrapper');
      if (commentBox) {
        const input = commentBox.querySelector('textarea');
        if (input) input.focus();
      }
    });
  });

  // Share buttons
  document.querySelectorAll('.post-share-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent post click
      console.log('Share clicked');
    });
  });
}


function bindDropdownToggles() {
  document.querySelectorAll('.post-dropdown-toggle').forEach(toggle => {
    // Prevent duplicate listeners by checking if it's already bound
    if (!toggle.dataset.bound) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = toggle.nextElementSibling;
        menu.classList.toggle('show');
      });
      toggle.dataset.bound = "true";
    }
  });

  // Add one global listener to close dropdowns
  if (!document.body.dataset.dropdownListenerBound) {
    document.addEventListener('click', () => {
      document.querySelectorAll('.post-dropdown-menu').forEach(menu => {
        menu.classList.remove('show');
      });
    });
    document.body.dataset.dropdownListenerBound = "true";
  }
}


function bindPostClickEvents() {
  console.log('🔍 Running bindPostClickEvents');
  document.querySelectorAll('.post[data-href]').forEach(post => {
    console.log('➡️ Binding post click:', post);
    post.addEventListener('click', async (e) => {
      


      if (e.target.closest('button') || e.target.closest('a')) return;

      const href = post.dataset.href;
      console.log('🖱️ Post clicked');
      console.log('📎 href:', href); // ⬅️ ADD THIS HERE
      if (!href) return;

      try {
        const res = await fetch(href, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (!res.ok) throw new Error('Failed to fetch post');

        

        const html = await res.text();
        console.log('📄 AJAX HTML Response:', html); // 🔍 ADD THIS LINE
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newContent = doc.querySelector('#appContent');

        if (newContent) {
          document.querySelector('#appContent').innerHTML = newContent.innerHTML;
          window.scrollTo(0, 0);
          window.history.pushState({}, '', href);
          bindAllPageEvents();
        }
      } catch (err) {
        console.error('AJAX post navigation failed:', err);
        window.location.href = href;
      }
    });
  });
}
