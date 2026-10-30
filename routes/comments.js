const express = require('express');
const db = require('../db');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!res.locals.currentUser) return res.redirect('/login');
  next();
}

// True when the request comes from our page script, not from a normal form click
const wantsJson = (req) => req.get('X-Requested-With') === 'fetch';

function commentCount(postId) {
  return db
    .prepare('SELECT COUNT(*) AS n FROM comments WHERE post_id = ? AND is_hidden = 0')
    .get(postId).n;
}

// Add a comment (or an answer) to a post
router.post('/posts/:id/comments', requireLogin, (req, res) => {
  const post = db
    .prepare('SELECT id FROM posts WHERE id = ? AND is_hidden = 0')
    .get(req.params.id);
  if (!post) return res.status(404).send('Post not found');

  const body = ((req.body && req.body.body) || '').trim();
  let commentId = null;

  if (body && body.length <= 1000) {
    const result = db
      .prepare('INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)')
      .run(post.id, req.session.userId, body);
    commentId = result.lastInsertRowid;
  }

  // For the page script: send back the finished comment as HTML
  if (wantsJson(req)) {
    if (!commentId) return res.status(400).json({ error: 'Please write something.' });

    const comment = db
      .prepare(`
        SELECT comments.id, comments.user_id, comments.body, comments.created_at,
               users.username, users.display_name, users.avatar
        FROM comments
        JOIN users ON users.id = comments.user_id
        WHERE comments.id = ?
      `)
      .get(commentId);

    return res.render('partials/comment', { c: comment }, (err, html) => {
      if (err) return res.status(500).json({ error: 'Could not show the comment.' });
      res.json({ html, count: commentCount(post.id) });
    });
  }

  res.redirect('/posts/' + post.id + '#comments');
});

// Delete your own comment
router.post('/comments/:id/delete', requireLogin, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).send('Comment not found');
  if (comment.user_id !== res.locals.currentUser.id) return res.status(403).send('Not allowed');

  db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);

  if (wantsJson(req)) return res.json({ deleted: true, count: commentCount(comment.post_id) });
  res.redirect('/posts/' + comment.post_id + '#comments');
});

module.exports = router;