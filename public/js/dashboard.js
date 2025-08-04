function bindPostActionButtons() {
  // Like buttons
  document.querySelectorAll('.post-like-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
  e.stopPropagation(); // Prevent post click
  const postId = btn.dataset.postId;
  const icon = btn.querySelector('i');
  const countSpan = btn.querySelector('span');
  const isLiked = icon.classList.contains('fa-solid');
  let currentCount = parseInt(countSpan.textContent, 10) || 0;

  // Optimistic UI update
  icon.classList.toggle('fa-solid', !isLiked);
  icon.classList.toggle('fa-regular', isLiked);
  countSpan.textContent = isLiked ? currentCount - 1 : currentCount + 1;

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

    // Revert icon and count
    icon.classList.toggle('fa-solid', isLiked);
    icon.classList.toggle('fa-regular', !isLiked);
    countSpan.textContent = isLiked ? currentCount : currentCount - 1;
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





function showLoadMoreWhenBottomReached() {
  const btn = document.getElementById('loadMoreBtn');
  if (!btn) return; // <-- 👈 Exit early if not on dashboard

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const viewportHeight = window.innerHeight;
    const totalHeight = document.body.scrollHeight;

    if (scrollTop + viewportHeight >= totalHeight - 100) {
      btn.style.display = 'block';
    }
  });

  btn.addEventListener('click', async () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(async () => {
      const seenPostIds = new Set();
      document.querySelectorAll('.post').forEach(post => {
        const postId = post.dataset.postId;
        if (postId) seenPostIds.add(postId);
      });

      try {
        await Promise.all([...seenPostIds].map(postId => {
          return fetch(`/api/posts/${postId}/seen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshed: true })
          });
        }));
      } catch (err) {
        console.error('⚠️ Failed to mark posts as refreshed:', err);
      }

      // 🧨 Problematic reload
      window.location.reload();
    }, 350);
  });
}

function forceShowLoadMoreIfNoPosts() {
  const posts = document.querySelectorAll('.post');
  const btn = document.getElementById('loadMoreBtn');
  if (btn && posts.length === 0) {
    btn.style.display = 'block';
  }
}



