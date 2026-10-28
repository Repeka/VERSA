const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const router = express.Router();

// Everything under /admin is for admins only
function requireAdmin(req, res, next) {
  const user = res.locals.currentUser;
  if (!user) return res.redirect('/login');
  if (user.role !== 'admin') return res.status(403).send('Admins only');
  next();
}
router.use('/admin', requireAdmin);

// Delete a post and everything attached to it
function deletePost(postId) {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) return;
  if (post.image) {
    fs.unlink(path.join(__dirname, '..', 'public', post.image), () => {});
  }
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM votes WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM bookmarks WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM reports WHERE post_id = ?').run(postId);
db.prepare('DELETE FROM reposts WHERE post_id = ?').run(postId);
db.prepare('DELETE FROM interests WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
}

// Ban or unban a member (never yourself, never another admin)
function setBan(req, res, value) {
  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (target && target.role !== 'admin' && target.id !== res.locals.currentUser.id) {
    db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(value, target.id);
  }
  const back = (req.body || {}).back === 'reports' ? '/admin/reports' : '/admin/users';
  res.redirect(back);
}

// Overview
router.get('/admin', (req, res) => {
  const count = (sql) => db.prepare(sql).get().n;
  const stats = {
    users: count('SELECT COUNT(*) AS n FROM users'),
    posts: count('SELECT COUNT(*) AS n FROM posts'),
    comments: count('SELECT COUNT(*) AS n FROM comments'),
    openReports: count("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
    banned: count('SELECT COUNT(*) AS n FROM users WHERE is_banned = 1')
  };

  // Sign-ups for each of the last 14 days (days with none show 0)
  const rows = db
    .prepare(`
      SELECT date(created_at) AS day, COUNT(*) AS n
      FROM users
      WHERE date(created_at) >= date('now', '-13 days')
      GROUP BY day
    `)
    .all();
  const perDay = Object.fromEntries(rows.map((r) => [r.day, r.n]));
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    days.push({ day, n: perDay[day] || 0 });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.n));

  const activeUsers = db
    .prepare(`
      SELECT username, posts, comments, (posts + comments) AS activity
      FROM (
        SELECT users.username,
          (SELECT COUNT(*) FROM posts WHERE posts.user_id = users.id) AS posts,
          (SELECT COUNT(*) FROM comments WHERE comments.user_id = users.id) AS comments
        FROM users
      )
      WHERE posts + comments > 0
      ORDER BY activity DESC
      LIMIT 5
    `)
    .all();

  const popularPosts = db
    .prepare(`
      SELECT posts.id, posts.title, posts.type, posts.is_hidden, users.username,
        COALESCE((SELECT SUM(value) FROM votes WHERE votes.post_id = posts.id), 0) AS score,
        (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments
      FROM posts
      JOIN users ON users.id = posts.user_id
      ORDER BY score DESC, comments DESC, posts.id DESC
      LIMIT 5
    `)
    .all();

  const byType = db
    .prepare('SELECT type, COUNT(*) AS n FROM posts GROUP BY type ORDER BY n DESC')
    .all();

  res.render('admin', {
    title: 'Admin',
    stats, days, maxDay, activeUsers, popularPosts, byType
  });
});

// Reports and hidden posts
router.get('/admin/reports', (req, res) => {
  const reportedPosts = db
    .prepare(`
      SELECT posts.id, posts.title, posts.type, posts.body, posts.is_hidden, posts.user_id,
             users.username, users.is_banned, users.role,
             COUNT(reports.id) AS report_count
      FROM reports
      JOIN posts ON posts.id = reports.post_id
      JOIN users ON users.id = posts.user_id
      WHERE reports.status = 'open'
      GROUP BY posts.id
      ORDER BY report_count DESC, posts.id DESC
    `)
    .all();

  const reasons = db.prepare(`
    SELECT reports.reason, reports.details, users.username AS reporter
    FROM reports
    JOIN users ON users.id = reports.reporter_id
    WHERE reports.post_id = ? AND reports.status = 'open'
  `);
  reportedPosts.forEach((p) => { p.reasons = reasons.all(p.id); });

  const hiddenPosts = db
    .prepare(`
      SELECT posts.id, posts.title, posts.type, users.username
      FROM posts
      JOIN users ON users.id = posts.user_id
      WHERE posts.is_hidden = 1
      ORDER BY posts.id DESC
    `)
    .all();

  res.render('admin-reports', { title: 'Admin · Reports', reportedPosts, hiddenPosts });
});

// Members
router.get('/admin/users', (req, res) => {
  const users = db
    .prepare(`
      SELECT users.id, users.username, users.email, users.role, users.is_banned, users.created_at,
        (SELECT COUNT(*) FROM posts WHERE posts.user_id = users.id) AS posts,
        (SELECT COUNT(*) FROM comments WHERE comments.user_id = users.id) AS comments
      FROM users
      ORDER BY users.id DESC
    `)
    .all();

  res.render('admin-users', { title: 'Admin · Users', users });
});

// Moderation actions
router.post('/admin/posts/:id/hide', (req, res) => {
  db.prepare('UPDATE posts SET is_hidden = 1 WHERE id = ?').run(req.params.id);
  db.prepare("UPDATE reports SET status = 'resolved' WHERE post_id = ? AND status = 'open'")
    .run(req.params.id);
  res.redirect('/admin/reports');
});

router.post('/admin/posts/:id/unhide', (req, res) => {
  db.prepare('UPDATE posts SET is_hidden = 0 WHERE id = ?').run(req.params.id);
  res.redirect('/admin/reports');
});

router.post('/admin/posts/:id/delete', (req, res) => {
  deletePost(req.params.id);
  res.redirect('/admin/reports');
});

router.post('/admin/reports/:postId/dismiss', (req, res) => {
  db.prepare("UPDATE reports SET status = 'dismissed' WHERE post_id = ? AND status = 'open'")
    .run(req.params.postId);
  res.redirect('/admin/reports');
});

router.post('/admin/users/:id/ban', (req, res) => setBan(req, res, 1));
router.post('/admin/users/:id/unban', (req, res) => setBan(req, res, 0));

module.exports = router;