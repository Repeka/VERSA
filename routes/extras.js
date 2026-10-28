const express = require('express');
const db = require('../db');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!res.locals.currentUser) return res.redirect('/login');
  next();
}

// Find a visible post, or stop with "not found"
function findPost(req, res) {
  const post = db
    .prepare('SELECT id, user_id FROM posts WHERE id = ? AND is_hidden = 0')
    .get(req.params.id);
  if (!post) res.status(404).send('Post not found');
  return post;
}

// Repost / undo repost (not your own posts)
router.post('/posts/:id/repost', requireLogin, (req, res) => {
  const post = findPost(req, res);
  if (!post) return;

  const userId = req.session.userId;
  if (post.user_id !== userId) {
    const existing = db
      .prepare('SELECT id FROM reposts WHERE post_id = ? AND user_id = ?')
      .get(post.id, userId);

    if (existing) {
      db.prepare('DELETE FROM reposts WHERE id = ?').run(existing.id);
    } else {
      db.prepare('INSERT INTO reposts (post_id, user_id) VALUES (?, ?)').run(post.id, userId);
    }
  }

  res.redirect('/posts/' + post.id);
});

// Interested / not interested (click the same one again to undo)
router.post('/posts/:id/interest', requireLogin, (req, res) => {
  const post = findPost(req, res);
  if (!post) return;

  const data = req.body || {};
  const value = data.value === 'yes' ? 1 : data.value === 'no' ? -1 : 0;
  const userId = req.session.userId;

  if (value !== 0 && post.user_id !== userId) {
    const existing = db
      .prepare('SELECT id, value FROM interests WHERE post_id = ? AND user_id = ?')
      .get(post.id, userId);

    if (existing && existing.value === value) {
      db.prepare('DELETE FROM interests WHERE id = ?').run(existing.id);
    } else if (existing) {
      db.prepare('UPDATE interests SET value = ? WHERE id = ?').run(value, existing.id);
    } else {
      db.prepare('INSERT INTO interests (post_id, user_id, value) VALUES (?, ?, ?)')
        .run(post.id, userId, value);
    }
  }

  // Clicked on the home feed? Go back there.
  res.redirect(data.next === 'feed' ? '/' : '/posts/' + post.id);
});

module.exports = router;