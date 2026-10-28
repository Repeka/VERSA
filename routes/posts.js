const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const router = express.Router();

// Where artwork images are saved (created automatically)
const imageDir = path.join(__dirname, '..', 'public', 'uploads', 'artworks');
fs.mkdirSync(imageDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: imageDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `art-${req.session.userId}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ok =
      ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext) &&
      file.mimetype.startsWith('image/');
    cb(ok ? null : new Error('Only image files (png, jpg, gif, webp) are allowed.'), ok);
  }
});

const TYPES = ['question', 'artwork', 'poem'];

function requireLogin(req, res, next) {
  if (!res.locals.currentUser) return res.redirect('/login');
  next();
}

// The "new post" page
router.get('/posts/new', requireLogin, (req, res) => {
  const type = TYPES.includes(req.query.type) ? req.query.type : 'question';
  res.render('post-new', { title: 'New post', type, error: null, form: {} });
});

// Save a new post
router.post('/posts', requireLogin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    const data = req.body || {};
    const type = TYPES.includes(data.type) ? data.type : 'question';
    const form = { title: data.title || '', body: data.body || '' };

    const fail = (msg) => {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.render('post-new', { title: 'New post', type, error: msg, form });
    };

    if (err) {
      return fail(err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller.' : err.message);
    }

    const postTitle = (data.title || '').trim();
    const body = (data.body || '').trim();

    if (!postTitle) return fail('Please add a title.');
    if (postTitle.length > 120) return fail('Title must be 120 characters or fewer.');
    if (body.length > 5000) return fail('Text is too long (5000 characters max).');
    if (type === 'question' && !body) return fail('Please add some details to your question.');
    if (type === 'poem' && !body) return fail('Please write your poem.');
    if (type === 'artwork' && !req.file) return fail('Please choose an image for your artwork.');

    // Only artwork keeps an image
    if (type !== 'artwork' && req.file) fs.unlink(req.file.path, () => {});
    const image = type === 'artwork' ? '/uploads/artworks/' + req.file.filename : '';

    const result = db
      .prepare('INSERT INTO posts (user_id, type, title, body, image) VALUES (?, ?, ?, ?, ?)')
      .run(req.session.userId, type, postTitle, body, image);

    res.redirect('/posts/' + result.lastInsertRowid);
  });
});

// View one post
router.get('/posts/:id', requireLogin, (req, res) => {
  const post = db
    .prepare(`
      SELECT posts.*, users.username, users.display_name, users.avatar
      FROM posts
      JOIN users ON users.id = posts.user_id
      WHERE posts.id = ? AND posts.is_hidden = 0
    `)
    .get(req.params.id);

  if (!post) return res.status(404).send('Post not found');

  const userId = req.session.userId;

  const comments = db
    .prepare(`
      SELECT comments.id, comments.user_id, comments.body, comments.created_at,
             users.username, users.display_name, users.avatar
      FROM comments
      JOIN users ON users.id = comments.user_id
      WHERE comments.post_id = ? AND comments.is_hidden = 0
      ORDER BY comments.id ASC
    `)
    .all(post.id);

  const score = db
    .prepare('SELECT COALESCE(SUM(value), 0) AS score FROM votes WHERE post_id = ?')
    .get(post.id).score;
  const myVote = db
    .prepare('SELECT value FROM votes WHERE post_id = ? AND user_id = ?')
    .get(post.id, userId);
  const bookmarked = !!db
    .prepare('SELECT 1 FROM bookmarks WHERE post_id = ? AND user_id = ?')
    .get(post.id, userId);
  const reported = !!db
    .prepare('SELECT 1 FROM reports WHERE post_id = ? AND reporter_id = ?')
    .get(post.id, userId);

    const repostCount = db
  .prepare('SELECT COUNT(*) AS n FROM reposts WHERE post_id = ?')
  .get(post.id).n;
const reposted = !!db
  .prepare('SELECT 1 FROM reposts WHERE post_id = ? AND user_id = ?')
  .get(post.id, userId);
const interestedCount = db
  .prepare('SELECT COUNT(*) AS n FROM interests WHERE post_id = ? AND value = 1')
  .get(post.id).n;
const myInterest = db
  .prepare('SELECT value FROM interests WHERE post_id = ? AND user_id = ?')
  .get(post.id, userId);

  res.render('post', {
    title: post.title,
    post,
    comments,
    score,
    vote: myVote ? myVote.value : 0,
    bookmarked,
    reported,
    justReported: req.query.reported === '1',
    repostCount,
reposted,
interestedCount,
interest: myInterest ? myInterest.value : 0,
    isOwner: post.user_id === userId
  });
});

// Delete your own post
router.post('/posts/:id/delete', requireLogin, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).send('Post not found');
  if (post.user_id !== res.locals.currentUser.id) return res.status(403).send('Not allowed');

  if (post.image) {
    fs.unlink(path.join(__dirname, '..', 'public', post.image), () => {});
  }
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(post.id);
  db.prepare('DELETE FROM votes WHERE post_id = ?').run(post.id);
db.prepare('DELETE FROM bookmarks WHERE post_id = ?').run(post.id);
db.prepare('DELETE FROM reports WHERE post_id = ?').run(post.id);
db.prepare('DELETE FROM reposts WHERE post_id = ?').run(post.id);
db.prepare('DELETE FROM interests WHERE post_id = ?').run(post.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  res.redirect('/u/' + res.locals.currentUser.username);
});

module.exports = router;