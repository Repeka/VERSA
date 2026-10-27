const express = require('express');
const db = require('../db');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!res.locals.currentUser) return res.redirect('/login');
  next();
}

// Add a comment (or an answer) to a post
router.post('/posts/:id/comments', requireLogin, (req, res) => {
  const post = db
    .prepare('SELECT id FROM posts WHERE id = ? AND is_hidden = 0')
    .get(req.params.id);
  if (!post) return res.status(404).send('Post not found');

  const body = ((req.body && req.body.body) || '').trim();
  if (body && body.length <= 1000) {
    db.prepare('INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)')
      .run(post.id, req.session.userId, body);
  }

  res.redirect('/posts/' + post.id + '#comments');
});

// Delete your own comment
router.post('/comments/:id/delete', requireLogin, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).send('Comment not found');
  if (comment.user_id !== res.locals.currentUser.id) return res.status(403).send('Not allowed');

  db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);
  res.redirect('/posts/' + comment.post_id + '#comments');
});

module.exports = router;