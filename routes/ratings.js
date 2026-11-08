const express = require('express');
const db = require('../db');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!res.locals.currentUser) return res.redirect('/login');
  next();
}

// True when the request comes from our page script, not from a normal form click
const wantsJson = (req) => req.get('X-Requested-With') === 'fetch';

// Rate a post from 1 to 5 stars (click your current rating again to remove it)
router.post('/posts/:id/rate', requireLogin, (req, res) => {
  const post = db
    .prepare('SELECT id, user_id FROM posts WHERE id = ? AND is_hidden = 0')
    .get(req.params.id);
  if (!post) return res.status(404).send('Post not found');

  const userId = req.session.userId;
  const stars = parseInt((req.body || {}).stars, 10);

  // No rating your own post, and only 1 to 5 stars
  if (post.user_id !== userId && stars >= 1 && stars <= 5) {
    const existing = db
      .prepare('SELECT id, stars FROM ratings WHERE post_id = ? AND user_id = ?')
      .get(post.id, userId);

    if (existing && existing.stars === stars) {
      db.prepare('DELETE FROM ratings WHERE id = ?').run(existing.id);
    } else if (existing) {
      db.prepare('UPDATE ratings SET stars = ? WHERE id = ?').run(stars, existing.id);
    } else {
      db.prepare('INSERT INTO ratings (post_id, user_id, stars) VALUES (?, ?, ?)')
        .run(post.id, userId, stars);
    }
  }

  if (wantsJson(req)) {
    // Your own rating and the public average. Who rated is never sent.
    const mine = db
      .prepare('SELECT stars FROM ratings WHERE post_id = ? AND user_id = ?')
      .get(post.id, userId);
    const summary = db
      .prepare('SELECT COUNT(*) AS count, COALESCE(ROUND(AVG(stars), 1), 0) AS average FROM ratings WHERE post_id = ?')
      .get(post.id);
    return res.json({ mine: mine ? mine.stars : 0, count: summary.count, average: summary.average });
  }

  res.redirect('/posts/' + post.id);
});

module.exports = router;