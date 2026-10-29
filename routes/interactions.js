const express = require('express');
const db = require('../db');

const router = express.Router();

const REASONS = ['Spam', 'Disrespectful or hateful', 'Inappropriate content', 'Other'];

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

// The current score of a post, and what this member voted
function voteState(postId, userId) {
  const score = db
    .prepare('SELECT COALESCE(SUM(value), 0) AS score FROM votes WHERE post_id = ?')
    .get(postId).score;
  const mine = db
    .prepare('SELECT value FROM votes WHERE post_id = ? AND user_id = ?')
    .get(postId, userId);
  return { score, vote: mine ? mine.value : 0 };
}

// Upvote / downvote (click the same arrow again to undo)
router.post('/posts/:id/vote', requireLogin, (req, res) => {
  const post = findPost(req, res);
  if (!post) return;

  const data = req.body || {};
  const value = data.value === 'up' ? 1 : data.value === 'down' ? -1 : 0;
  const userId = req.session.userId;

  // No voting on your own posts
  if (value !== 0 && post.user_id !== userId) {
    const existing = db
      .prepare('SELECT value FROM votes WHERE post_id = ? AND user_id = ?')
      .get(post.id, userId);

    if (existing && existing.value === value) {
      db.prepare('DELETE FROM votes WHERE post_id = ? AND user_id = ?').run(post.id, userId);
    } else if (existing) {
      db.prepare('UPDATE votes SET value = ? WHERE post_id = ? AND user_id = ?')
        .run(value, post.id, userId);
    } else {
      db.prepare('INSERT INTO votes (post_id, user_id, value) VALUES (?, ?, ?)')
        .run(post.id, userId, value);
    }
  }

  if (wantsJson(req)) return res.json(voteState(post.id, userId));
  res.redirect('/posts/' + post.id);
});

// Save / unsave a post
router.post('/posts/:id/bookmark', requireLogin, (req, res) => {
  const post = findPost(req, res);
  if (!post) return;

  const userId = req.session.userId;
  const existing = db
    .prepare('SELECT id FROM bookmarks WHERE post_id = ? AND user_id = ?')
    .get(post.id, userId);

  if (existing) {
    db.prepare('DELETE FROM bookmarks WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO bookmarks (post_id, user_id) VALUES (?, ?)').run(post.id, userId);
  }

  if (wantsJson(req)) return res.json({ bookmarked: !existing });
  res.redirect('/posts/' + post.id);
});

// Report a post
router.post('/posts/:id/report', requireLogin, (req, res) => {
  const post = findPost(req, res);
  if (!post) return;

  const data = req.body || {};
  if (post.user_id !== req.session.userId) {
    const reason = REASONS.includes(data.reason) ? data.reason : 'Other';
    const details = (data.details || '').trim().slice(0, 500);
    db.prepare('INSERT OR IGNORE INTO reports (post_id, reporter_id, reason, details) VALUES (?, ?, ?, ?)')
      .run(post.id, req.session.userId, reason, details);
  }

  res.redirect('/posts/' + post.id + '?reported=1');
});

// Your saved posts
router.get('/bookmarks', requireLogin, (req, res) => {
  const posts = db
    .prepare(`
      SELECT posts.id, posts.type, posts.title, posts.body, posts.image, posts.created_at,
             users.username, users.display_name, users.avatar,
             (SELECT COALESCE(SUM(value), 0) FROM votes WHERE votes.post_id = posts.id) AS score,
             (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id AND comments.is_hidden = 0) AS comment_count
      FROM bookmarks
      JOIN posts ON posts.id = bookmarks.post_id
      JOIN users ON users.id = posts.user_id
      WHERE bookmarks.user_id = ? AND posts.is_hidden = 0
      ORDER BY bookmarks.id DESC
    `)
    .all(req.session.userId);

  res.render('bookmarks', { title: 'Saved', posts });
});

module.exports = router;