const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const router = express.Router();

// Where challenge drawings are saved (created automatically)
const imageDir = path.join(__dirname, '..', 'public', 'uploads', 'challenges');
fs.mkdirSync(imageDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: imageDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `entry-${req.session.userId}-${Date.now()}${ext}`);
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

function requireLogin(req, res, next) {
  if (!res.locals.currentUser) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  const user = res.locals.currentUser;
  if (!user) return res.redirect('/login');
  if (user.role !== 'admin') return res.status(403).send('Admins only');
  next();
}

// A challenge is open until its deadline
const isOpen = (challenge) => Date.parse(challenge.deadline) > Date.now();

function removeFile(publicPath) {
  if (publicPath) {
    fs.unlink(path.join(__dirname, '..', 'public', publicPath), () => {});
  }
}

function discardUpload(req) {
  if (req.file) fs.unlink(req.file.path, () => {});
}

// Show one challenge page (used by the page itself and by form errors)
function showChallenge(res, challenge, extra) {
  const user = res.locals.currentUser;
  const open = isOpen(challenge);

  // Most votes first. On a tie, the earlier entry comes first.
  const entries = db
    .prepare(`
      SELECT submissions.*, users.username, users.display_name, users.avatar,
        (SELECT COUNT(*) FROM challenge_votes
          WHERE challenge_votes.submission_id = submissions.id) AS votes
      FROM submissions
      JOIN users ON users.id = submissions.user_id
      WHERE submissions.challenge_id = ?
      ORDER BY votes DESC, submissions.id ASC
    `)
    .all(challenge.id);

  const myEntry = entries.find((e) => e.user_id === user.id) || null;
  const myVote = db
    .prepare('SELECT submission_id FROM challenge_votes WHERE challenge_id = ? AND user_id = ?')
    .get(challenge.id, user.id);
  const winner = !open && entries.length > 0 && entries[0].votes > 0 ? entries[0] : null;

  res.render('challenge', Object.assign({
    title: challenge.title,
    challenge,
    isOpen: open,
    entries,
    myEntry,
    myVoteId: myVote ? myVote.submission_id : null,
    winner,
    isAdmin: user.role === 'admin',
    error: null,
    form: {}
  }, extra));
}

// All challenges
router.get('/challenges', requireLogin, (req, res) => {
  const rows = db
    .prepare(`
      SELECT challenges.*,
        (SELECT COUNT(*) FROM submissions WHERE submissions.challenge_id = challenges.id) AS entries
      FROM challenges
    `)
    .all();

  rows.forEach((c) => { c.isOpen = isOpen(c); });
  const open = rows.filter((c) => c.isOpen).sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline));
  const closed = rows.filter((c) => !c.isOpen).sort((a, b) => Date.parse(b.deadline) - Date.parse(a.deadline));

  res.render('challenges', { title: 'Challenges', open, closed });
});

// New challenge form (admin)
router.get('/challenges/new', requireAdmin, (req, res) => {
  res.render('challenge-new', { title: 'New challenge', error: null, form: {} });
});

// Create a challenge (admin)
router.post('/challenges', requireAdmin, (req, res) => {
  const data = req.body || {};
  const form = { title: data.title || '', rules: data.rules || '' };
  const fail = (msg) => res.render('challenge-new', { title: 'New challenge', error: msg, form });

  const title = (data.title || '').trim();
  const rules = (data.rules || '').trim();
  const deadline = new Date(data.deadline || '');

  if (!title || title.length > 100) return fail('Please add a title (100 characters or fewer).');
  if (!rules || rules.length > 2000) return fail('Please write the rules (2000 characters or fewer).');
  if (isNaN(deadline.getTime())) return fail('Please pick a deadline.');
  if (deadline.getTime() <= Date.now()) return fail('The deadline must be in the future.');

  const result = db
    .prepare('INSERT INTO challenges (title, rules, deadline, created_by) VALUES (?, ?, ?, ?)')
    .run(title, rules, deadline.toISOString(), req.session.userId);

  res.redirect('/challenges/' + result.lastInsertRowid);
});

// One challenge
router.get('/challenges/:id', requireLogin, (req, res) => {
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  if (!challenge) return res.status(404).send('Challenge not found');
  showChallenge(res, challenge);
});

// Submit an entry
router.post('/challenges/:id/submit', requireLogin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
    if (!challenge) {
      discardUpload(req);
      return res.status(404).send('Challenge not found');
    }

    const data = req.body || {};
    const form = { title: data.title || '', description: data.description || '' };
    const fail = (msg) => {
      discardUpload(req);
      showChallenge(res, challenge, { error: msg, form });
    };

    if (err) {
      return fail(err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller.' : err.message);
    }
    if (!isOpen(challenge)) return fail('This challenge is closed.');

    const already = db
      .prepare('SELECT id FROM submissions WHERE challenge_id = ? AND user_id = ?')
      .get(challenge.id, req.session.userId);
    if (already) return fail('You already entered this challenge.');

    const entryTitle = (data.title || '').trim();
    const description = (data.description || '').trim();
    if (!entryTitle || entryTitle.length > 100) return fail('Please add a title (100 characters or fewer).');
    if (description.length > 500) return fail('Description must be 500 characters or fewer.');
    if (!req.file) return fail('Please choose an image for your entry.');

    db.prepare(
      'INSERT INTO submissions (challenge_id, user_id, title, description, image) VALUES (?, ?, ?, ?, ?)'
    ).run(challenge.id, req.session.userId, entryTitle, description, '/uploads/challenges/' + req.file.filename);

    res.redirect('/challenges/' + challenge.id);
  });
});

// True when the request comes from our page script, not from a normal form click
const wantsJson = (req) => req.get('X-Requested-With') === 'fetch';

// The vote count of every entry in a challenge, and what this member voted for
function challengeVoteState(challengeId, userId) {
  const counts = {};
  db.prepare(`
    SELECT submissions.id,
      (SELECT COUNT(*) FROM challenge_votes
        WHERE challenge_votes.submission_id = submissions.id) AS votes
    FROM submissions
    WHERE submissions.challenge_id = ?
  `)
    .all(challengeId)
    .forEach((row) => { counts[row.id] = row.votes; });

  const mine = db
    .prepare('SELECT submission_id FROM challenge_votes WHERE challenge_id = ? AND user_id = ?')
    .get(challengeId, userId);

  return { counts, votedId: mine ? mine.submission_id : null };
}

// Vote for an entry (one vote per challenge, click again to undo)
router.post('/challenges/:id/vote', requireLogin, (req, res) => {
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  if (!challenge) return res.status(404).send('Challenge not found');

  const back = '/challenges/' + challenge.id;
  const userId = req.session.userId;

  // The page script gets the new numbers, a normal form click gets a redirect
  const reply = () =>
    wantsJson(req) ? res.json(challengeVoteState(challenge.id, userId)) : res.redirect(back);

  if (!isOpen(challenge)) return reply();

  const submissionId = parseInt((req.body || {}).submission_id, 10) || 0;
  const entry = db
    .prepare('SELECT id, user_id FROM submissions WHERE id = ? AND challenge_id = ?')
    .get(submissionId, challenge.id);

  // No voting for your own entry
  if (entry && entry.user_id !== userId) {
    const existing = db
      .prepare('SELECT id, submission_id FROM challenge_votes WHERE challenge_id = ? AND user_id = ?')
      .get(challenge.id, userId);

    if (existing && existing.submission_id === entry.id) {
      db.prepare('DELETE FROM challenge_votes WHERE id = ?').run(existing.id);
    } else if (existing) {
      db.prepare('UPDATE challenge_votes SET submission_id = ? WHERE id = ?').run(entry.id, existing.id);
    } else {
      db.prepare('INSERT INTO challenge_votes (challenge_id, submission_id, user_id) VALUES (?, ?, ?)')
        .run(challenge.id, entry.id, userId);
    }
  }

  reply();
});

// Withdraw your entry (while open) or remove any entry (admin)
router.post('/submissions/:id/delete', requireLogin, (req, res) => {
  const entry = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).send('Entry not found');

  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(entry.challenge_id);
  const user = res.locals.currentUser;
  const isAdmin = user.role === 'admin';
  const isOwner = entry.user_id === user.id;

  if (!(isAdmin || (isOwner && challenge && isOpen(challenge)))) {
    return res.status(403).send('Not allowed');
  }

  removeFile(entry.image);
  db.prepare('DELETE FROM challenge_votes WHERE submission_id = ?').run(entry.id);
  db.prepare('DELETE FROM submissions WHERE id = ?').run(entry.id);
  res.redirect('/challenges/' + entry.challenge_id);
});

// Delete a whole challenge (admin)
router.post('/challenges/:id/delete', requireAdmin, (req, res) => {
  const entries = db.prepare('SELECT image FROM submissions WHERE challenge_id = ?').all(req.params.id);
  entries.forEach((e) => removeFile(e.image));

  db.prepare('DELETE FROM challenge_votes WHERE challenge_id = ?').run(req.params.id);
  db.prepare('DELETE FROM submissions WHERE challenge_id = ?').run(req.params.id);
  db.prepare('DELETE FROM challenges WHERE id = ?').run(req.params.id);
  res.redirect('/challenges');
});

module.exports = router;