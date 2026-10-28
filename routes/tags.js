const express = require('express');
const db = require('../db');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!res.locals.currentUser) return res.redirect('/login');
  next();
}

// All tags, most used first
router.get('/tags', requireLogin, (req, res) => {
  const tags = db
    .prepare(`
      SELECT post_tags.tag, COUNT(*) AS n
      FROM post_tags
      JOIN posts ON posts.id = post_tags.post_id
      WHERE posts.is_hidden = 0
      GROUP BY post_tags.tag
      ORDER BY n DESC, post_tags.tag
      LIMIT 200
    `)
    .all();

  res.render('tags', { title: 'Tags', tags });
});

// All posts with one tag
router.get('/tags/:tag', requireLogin, (req, res) => {
  const tag = String(req.params.tag || '').toLowerCase().slice(0, 40);

  const posts = db
    .prepare(`
      SELECT posts.id, posts.type, posts.title, posts.body, posts.image, posts.created_at,
             users.username, users.display_name, users.avatar,
             (SELECT COALESCE(SUM(value), 0) FROM votes WHERE votes.post_id = posts.id) AS score,
             (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id AND comments.is_hidden = 0) AS comment_count
      FROM post_tags
      JOIN posts ON posts.id = post_tags.post_id
      JOIN users ON users.id = posts.user_id
      WHERE post_tags.tag = ? AND posts.is_hidden = 0
      ORDER BY posts.id DESC
      LIMIT 50
    `)
    .all(tag);

  res.render('tag', { title: '#' + tag, tag, posts });
});

module.exports = router;