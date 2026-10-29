const express = require('express');
const db = require('../db');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!res.locals.currentUser) return res.redirect('/login');
  next();
}

// True when the request comes from our page script, not from a normal form click
const wantsJson = (req) => req.get('X-Requested-With') === 'fetch';

// Find a visible post, or stop with "not found"
function findPost(req, res) {
  const post = db
    .prepare('SELECT id, user_id FROM posts WHERE id = ? AND is_hidden = 0')
    .get(req.params.id);
  if (!post) res.status(404).send('Post not found');
  return post;
}

// The numbers shown under a post
function counts(postId) {
  const reposts = db
    .prepare('SELECT COUNT(*) AS n FROM reposts WHERE post_id = ?')
    .get(postId).n;
  const interested = db
    .prepare('SELECT COUNT(*) AS n FROM interests WHERE post_id = ? AND value = 1')
    .get(postId).n;
  return { reposts, interested };
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

  if (wantsJson(req)) {
    const mine = db
      .prepare('SELECT 1 FROM reposts WHERE post_id = ? AND user_id = ?')
      .get(post.id, userId);
    return res.json({ reposted: !!mine, ...counts(post.id) });
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

  if (wantsJson(req)) {
    const mine = db
      .prepare('SELECT value FROM interests WHERE post_id = ? AND user_id = ?')
      .get(post.id, userId);
    return res.json({ interest: mine ? mine.value : 0, ...counts(post.id) });
  }

  // Clicked on the home feed? Go back there.
  res.redirect(data.next === 'feed' ? '/' : '/posts/' + post.id);
});

module.exports = router;