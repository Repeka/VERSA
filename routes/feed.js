const express = require('express');
const db = require('../db');

const router = express.Router();

const TYPES = ['question', 'artwork', 'poem'];

// Home feed for logged-in members
router.get('/', (req, res) => {
  const type = TYPES.includes(req.query.type) ? req.query.type : 'all';
  const filter = type === 'all' ? '' : 'AND posts.type = ?';
  const params = type === 'all' ? [] : [type];

  const posts = db
    .prepare(`
      SELECT posts.id, posts.type, posts.title, posts.body, posts.image, posts.created_at,
             users.username, users.display_name, users.avatar,
             (SELECT COALESCE(SUM(value), 0) FROM votes WHERE votes.post_id = posts.id) AS score
      FROM posts
      JOIN users ON users.id = posts.user_id
      WHERE posts.is_hidden = 0 ${filter}
      ORDER BY posts.id DESC
      LIMIT 50
    `)
    .all(...params);

  res.render('feed', { title: 'Home', posts, type });
});

module.exports = router;