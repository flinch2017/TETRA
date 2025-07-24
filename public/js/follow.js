function initFollowButton() {
  const followBtn = document.querySelector('.follow-btn');
  if (followBtn) {
    followBtn.addEventListener('click', async () => {
      const targetAcode = followBtn.getAttribute('data-target');
      const isFollowing = followBtn.getAttribute('data-following') === 'true';

      try {
        const url = isFollowing ? '/unfollow' : '/follow';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetAcode })
        });
        const data = await res.json();

        if (data.success) {
          followBtn.textContent = isFollowing ? 'Follow' : 'Following';
          followBtn.setAttribute('data-following', isFollowing ? 'false' : 'true');

          const followerCountElem = document.querySelector('.artist-follow');
          if (followerCountElem) {
            let count = parseInt(followerCountElem.textContent) || 0;
            count = isFollowing ? count - 1 : count + 1;
            followerCountElem.textContent = `${count} followers`;
          }
        } else {
          alert(data.message || 'Action failed');
        }
      } catch (err) {
        console.error('Follow/unfollow failed:', err);
        alert('An error occurred');
      }
    });
  }
}
