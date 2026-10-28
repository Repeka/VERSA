const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const router = express.Router();

// Where avatar pictures are saved (created automatically)
const avatarDir = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
fs.mkdirSync(avatarDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: avatarDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `user-${req.session.userId}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ok = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
    cb(ok ? null : new Error('Only image files (png, jpg, gif, webp) are allowed.'), ok);
  }
});

// Only logged-in people can use VERSA
function requireLogin(req, res, next) {
  if (!res.locals.currentUser) return res.redirect('/login');
  next();
}

// View a profile
router.get('/u/:username', requireLogin, (req, res) => {
  const profileUser = db
    .prepare('SELECT id, username, display_name, bio, avatar, created_at FROM users WHERE username = ?')
    .get(req.params.username);

  if (!profileUser) return res.status(404).send('User not found');

  const me = res.locals.currentUser;
  const isOwner = profileUser.id === me.id;

  // Filter tabs: All / Questions / Artwork / Poems
  const types = ['question', 'artwork', 'poem'];
  const type = types.includes(req.query.type) ? req.query.type : 'all';
  const filter = type === 'all' ? '' : 'AND posts.type = ?';
  const params = type === 'all' ? [profileUser.id] : [profileUser.id, type];

  const posts = db
    .prepare(`
      SELECT posts.id, posts.type, posts.title, posts.body, posts.image, posts.created_at,
             users.username, users.display_name, users.avatar,
             (SELECT COALESCE(SUM(value), 0) FROM votes WHERE votes.post_id = posts.id) AS score,
             (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id AND comments.is_hidden = 0) AS comment_count
      FROM posts
      JOIN users ON users.id = posts.user_id
      WHERE posts.user_id = ? AND posts.is_hidden = 0 ${filter}
      ORDER BY posts.id DESC
    `)
    .all(...params);

  const stats = db
    .prepare(`
      SELECT
        (SELECT COUNT(*) FROM posts WHERE posts.user_id = ? AND posts.is_hidden = 0) AS posts,
        (SELECT COALESCE(SUM(votes.value), 0) FROM votes
           JOIN posts ON posts.id = votes.post_id
           WHERE posts.user_id = ? AND posts.is_hidden = 0) AS votes,
        (SELECT COUNT(*) FROM comments
           JOIN posts ON posts.id = comments.post_id
           WHERE posts.user_id = ? AND posts.is_hidden = 0
             AND comments.is_hidden = 0 AND comments.user_id != posts.user_id) AS comments
    `)
    .get(profileUser.id, profileUser.id, profileUser.id);

  // On your own profile: the latest comments other people left on your posts
  let recentComments = [];
  if (isOwner) {
    recentComments = db
      .prepare(`
        SELECT comments.id, comments.post_id, comments.body, comments.created_at,
               posts.title AS post_title, users.username
        FROM comments
        JOIN posts ON posts.id = comments.post_id
        JOIN users ON users.id = comments.user_id
        WHERE posts.user_id = ? AND comments.user_id != ?
          AND comments.is_hidden = 0 AND posts.is_hidden = 0
        ORDER BY comments.id DESC
        LIMIT 10
      `)
      .all(me.id, me.id);
  }

  res.render('profile', {
    title: profileUser.username,
    profileUser,
    isOwner,
    posts,
    stats,
    type,
    recentComments
  });
});

// Edit page
router.get('/profile/edit', requireLogin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  res.render('profile-edit', { title: 'Edit profile', error: null, user });
});

// Save changes
router.post('/profile/edit', requireLogin, (req, res) => {
  upload.single('avatar')(req, res, (err) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 2 MB or smaller.' : err.message;
      return res.render('profile-edit', { title: 'Edit profile', error: msg, user });
    }

    const displayName = (req.body.display_name || '').trim().slice(0, 40);
    const bio = (req.body.bio || '').trim().slice(0, 300);

    let avatar = user.avatar;
    if (req.file) {
      avatar = '/uploads/avatars/' + req.file.filename;
      if (user.avatar) {
        // remove the old picture
        fs.unlink(path.join(__dirname, '..', 'public', user.avatar), () => {});
      }
    }

    db.prepare('UPDATE users SET display_name = ?, bio = ?, avatar = ? WHERE id = ?')
      .run(displayName, bio, avatar, user.id);

    res.redirect('/u/' + user.username);
  });
});

module.exports = router;