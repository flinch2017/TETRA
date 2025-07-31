function bindPostViewEvents() {

  // Like button logic
  document.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('.post-like-btn');
    if (!btn) return;

    const postId = btn.dataset.postId;
    const icon = btn.querySelector('i');
    const isLiked = icon.classList.contains('fa-solid');

    icon.classList.toggle('fa-solid', !isLiked);
    icon.classList.toggle('fa-regular', isLiked);

    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liked: !isLiked })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error('Like failed');
    } catch (err) {
      console.error('Failed to toggle like:', err);
      icon.classList.toggle('fa-solid', isLiked);
      icon.classList.toggle('fa-regular', !isLiked);
    }
  });

  

  const commentForm = document.querySelector('#commentForm');
  const commentInput = document.querySelector('#commentInput');
  const charCounter = document.querySelector('#charCounter');

  if (commentInput) {
    commentInput.addEventListener('input', () => {
      commentInput.style.height = 'auto';
      commentInput.style.height = commentInput.scrollHeight + 'px';

      if (charCounter) {
        charCounter.textContent = `${commentInput.value.length}/1000`;
      }
    });
  }

  // ✅ Read postId from the form itself
  commentForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const comment = commentInput.value.trim();
    if (!comment) return;

    const postId = commentForm?.dataset.postId;

if (!postId) {
  console.error('❌ Missing postId: check if data-post-id is correctly rendered in commentForm');
  alert('Cannot submit comment. Post ID is missing.');
  return;
}


    try {
      const res = await fetch(`/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      });

      const data = await res.json();

      if (res.ok && data.comment && data.username && data.timeAgo) {
        const commentSection = document.querySelector('.post-commentsX');
        document.querySelector('.no-commentsX')?.remove();

        const wrapper = document.createElement('div');
        wrapper.classList.add('comment-itemX');

        wrapper.innerHTML = `
          ${data.pfp_url ? `<img src="${data.pfp_url}" class="comment-pfp" alt="pfp" />` : ''}
          <strong>${data.username}</strong>
          <span class="comment-timeX">• ${data.timeAgo}</span>
          <p class="comment-textX">${data.comment}</p>
        `;

        commentSection.appendChild(wrapper);

        commentInput.value = '';
        commentInput.style.height = 'auto';
        if (charCounter) charCounter.textContent = '0/1000';
        
      } else {
        alert(data.error || 'Failed to post comment.');
      }
    } catch (err) {
      console.error(err);
    }
  });
}
