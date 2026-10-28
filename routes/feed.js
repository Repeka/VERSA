const express = require('express');
const db = require('../db');

const router = express.Router();

const TYPES = ['question', 'artwork', 'poem'];

// Home feed for logged-in members
router.get('/', (req, res) => {
  const type = TYPES.includes(req.query.type) ? req.query.type : 'all';
  const filter = type === 'all' ? '' : 'AND posts.type = ?';
  const typeParams = type === 'all' ? [] : [type];
  const userId = res.locals.currentUser.id;

  // Posts you marked "not interested" stay out of your feed
  const notHidden = `AND posts.id NOT IN (
    SELECT post_id FROM interests WHERE user_id = ? AND value = -1
  )`;

  const columns = `
    posts.id, posts.type, posts.title, posts.body, posts.image, posts.created_at,
    users.username, users.display_name, users.avatar,
    (SELECT COALESCE(SUM(value), 0) FROM votes WHERE votes.post_id = posts.id) AS score,
    (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id AND comments.is_hidden = 0) AS comment_count
  `;

  // New posts, plus reposts shown at the time they were reposted
  const posts = db
    .prepare(`
      SELECT ${columns}, posts.created_at AS sort_time, posts.id AS sort_id, NULL AS reposted_by
      FROM posts
      JOIN users ON users.id = posts.user_id
      WHERE posts.is_hidden = 0 ${filter} ${notHidden}

      UNION ALL

      SELECT ${columns}, reposts.created_at AS sort_time, posts.id AS sort_id, reposter.username AS reposted_by
      FROM reposts
      JOIN posts ON posts.id = reposts.post_id
      JOIN users ON users.id = posts.user_id
      JOIN users AS reposter ON reposter.id = reposts.user_id
      WHERE posts.is_hidden = 0 ${filter} ${notHidden}

      ORDER BY sort_time DESC, sort_id DESC
      LIMIT 50
    `)
    .all(...typeParams, userId, ...typeParams, userId);

  res.render('feed', { title: 'Home', posts, type });
});

module.exports = router;