// VERSA page script: lets some buttons work without reloading the page.
// If anything goes wrong, the page simply reloads and shows the real state.

(function () {
  // Which forms we handle, and what to do with the answer from the server
  var handlers = [
    { test: /\/posts\/\d+\/vote$/, run: updateVote },
    { test: /\/posts\/\d+\/bookmark$/, run: updateBookmark },
    { test: /\/posts\/\d+\/repost$/, run: updateRepost },
    { test: /\/posts\/\d+\/interest$/, run: updateInterest },
    { test: /\/u\/[A-Za-z0-9_]+\/follow$/, run: updateFollow }
  ];

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.method.toLowerCase() !== 'post') return;
    if (form.enctype === 'multipart/form-data') return;

    var path = new URL(form.action, window.location.href).pathname;
    var handler = handlers.find(function (h) { return h.test.test(path); });
    if (!handler) return;

    event.preventDefault();
    send(form, handler.run);
  });

  function send(form, done) {
    var button = form.querySelector('button');
    if (button) button.disabled = true;

    fetch(form.action, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'fetch',
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(new FormData(form))
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Request failed');
        return response.json();
      })
      .then(function (data) {
        done(form, data);
        if (button) button.disabled = false;
      })
      .catch(function () {
        // Something unexpected: show the real state of the page
        window.location.reload();
      });
  }

  // A small bounce, to show that something happened
  function pop(element) {
    if (!element) return;
    element.classList.remove('pop');
    void element.offsetWidth; // restart the animation
    element.classList.add('pop');
  }

  // A short message at the bottom of the screen
  function toast(message) {
    var box = document.getElementById('toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast';
      box.className = 'toast';
      box.setAttribute('role', 'status');
      document.body.appendChild(box);
    }
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { box.classList.remove('show'); }, 3500);
  }

  // Votes and saves
  function updateVote(form, data) {
    var box = form.closest('.vote-box');
    if (!box) return;

    var score = box.querySelector('.score');
    score.textContent = data.score;
    pop(score);

    box.querySelectorAll('form').forEach(function (f) {
      var field = f.querySelector('input[name="value"]');
      var button = f.querySelector('button');
      if (!field || !button) return;
      button.classList.toggle('active-up', field.value === 'up' && data.vote === 1);
      button.classList.toggle('active-down', field.value === 'down' && data.vote === -1);
    });
  }

  function updateBookmark(form, data) {
    var button = form.querySelector('button');
    if (!button) return;
    button.textContent = data.bookmarked ? '★ Saved' : '☆ Save';
    button.classList.toggle('active', data.bookmarked);
    pop(button);
  }

  // Reposts and interested / not interested
  function updateCounter(form, data) {
    var row = form.closest('.actions-secondary');
    var counter = row && row.querySelector('.post-date');
    if (!counter) return;
    counter.textContent =
      data.reposts + ' repost' + (data.reposts === 1 ? '' : 's') +
      ' · ' + data.interested + ' interested';
  }

  function updateRepost(form, data) {
    var button = form.querySelector('button');
    if (!button) return;
    button.textContent = data.reposted ? '🔁 Reposted' : '🔁 Repost';
    button.classList.toggle('active', data.reposted);
    pop(button);
    updateCounter(form, data);
  }

  function updateInterest(form, data) {
    // "Not interested" on the home feed: the card fades away
    if (form.classList.contains('feed-hide')) {
      if (data.interest === -1) hideCards(form.action);
      return;
    }

    var row = form.closest('.actions-secondary');
    if (!row) return;

    row.querySelectorAll('form').forEach(function (f) {
      var field = f.querySelector('input[name="value"]');
      var button = f.querySelector('button');
      if (!field || !button) return;
      if (field.value === 'yes') button.classList.toggle('active', data.interest === 1);
      if (field.value === 'no') button.classList.toggle('active', data.interest === -1);
    });

    pop(form.querySelector('button'));
    updateCounter(form, data);
  }

  // Remove every card of that post from the feed (an original and a repost can both be there)
  function hideCards(action) {
    document.querySelectorAll('.feed-hide').forEach(function (f) {
      if (f.action !== action) return;
      var card = f.closest('.feed-card');
      if (!card) return;
      card.classList.add('card-leave');
      setTimeout(function () { card.remove(); }, 300);
    });
    toast('Hidden from your feed. You can undo it on the post page.');
  }

  // Follow buttons: profile, followers lists and the "Who to follow" box
  function updateFollow(form, data) {
    var button = form.querySelector('button');
    if (!button) return;

    if (button.classList.contains('btn-follow')) {
      button.textContent = data.following ? '✓ Following' : '+ Follow';
      button.classList.toggle('following', data.following);
    } else if (button.classList.contains('side-follow')) {
      button.textContent = data.following ? 'Following' : 'Follow';
      button.classList.toggle('done', data.following);
    } else {
      button.textContent = data.following ? '✓ Following' : '+ Follow';
      button.classList.toggle('active', data.following);
    }
    pop(button);

    // On a profile page, the followers number changes too
    if (form.closest('.profile-card')) {
      var count = document.querySelector('.profile-stats a[href$="/followers"] strong');
      if (count) count.textContent = data.followers;
    }
  }
})();