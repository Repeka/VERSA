const express = require('express');
const db = require('../db');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!res.locals.currentUser) return res.redirect('/login');
  next();
}

// Turn what someone typed into a safe pattern, so that % and _ are searched literally
function likePattern(text) {
  return '%' + text.replace(/[\\%_]/g, '\\$&') + '%';
}

router.get('/search', requireLogin, (req, res) => {
  // A leading # is allowed, so searching "#nature" works
  const q = String(req.query.q || '').trim().replace(/^#+/, '').slice(0, 60);
  const tooShort = q.length > 0 && q.length < 2;

  let posts = [];
  let people = [];

  if (q.length >= 2) {
    const pattern = likePattern(q);

    people = db
      .prepare(`
        SELECT id, username, display_name, avatar, bio
        FROM users
        WHERE is_banned = 0
          AND (username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\')
        ORDER BY username COLLATE NOCASE
        LIMIT 20
      `)
      .all(pattern, pattern);

    posts = db
      .prepare(`
        SELECT posts.id, posts.type, posts.title, posts.body, posts.image, posts.created_at,
               users.username, users.display_name, users.avatar,
               (SELECT COALESCE(SUM(value), 0) FROM votes WHERE votes.post_id = posts.id) AS score,
               (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id AND comments.is_hidden = 0) AS comment_count
        FROM posts
        JOIN users ON users.id = posts.user_id
        WHERE posts.is_hidden = 0
          AND (posts.title LIKE ? ESCAPE '\\'
               OR posts.body LIKE ? ESCAPE '\\'
               OR posts.id IN (SELECT post_id FROM post_tags WHERE tag LIKE ? ESCAPE '\\'))
        ORDER BY posts.id DESC
        LIMIT 30
      `)
      .all(pattern, pattern, pattern);
  }

  res.render('search', { title: 'Search', q, tooShort, posts, people });
});

module.exports = router;