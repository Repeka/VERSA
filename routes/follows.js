const express = require('express');
const db = require('../db');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!res.locals.currentUser) return res.redirect('/login');
  next();
}

// True when the request comes from our page script, not from a normal form click
const wantsJson = (req) => req.get('X-Requested-With') === 'fetch';

// Follow / unfollow
router.post('/u/:username/follow', requireLogin, (req, res) => {
  const target = db
    .prepare('SELECT id, username FROM users WHERE username = ?')
    .get(req.params.username);
  if (!target) return res.status(404).send('User not found');

  const me = res.locals.currentUser;

  // You can't follow yourself
  if (target.id !== me.id) {
    const existing = db
      .prepare('SELECT id FROM follows WHERE follower_id = ? AND followed_id = ?')
      .get(me.id, target.id);

    if (existing) {
      db.prepare('DELETE FROM follows WHERE id = ?').run(existing.id);
    } else {
      db.prepare('INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)').run(me.id, target.id);
    }
  }

  // Answer for the page script: the new state, without a redirect
  if (wantsJson(req)) {
    const following = !!db
      .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?')
      .get(me.id, target.id);
    const followers = db
      .prepare('SELECT COUNT(*) AS n FROM follows WHERE followed_id = ?')
      .get(target.id).n;
    return res.json({ following, followers });
  }

  // Come back to the home page or the followers / following list if the click happened there
  const back = (req.body || {}).back;
  if (
    typeof back === 'string' &&
    (back === '/' || /^\/u\/[A-Za-z0-9_]+\/(followers|following)$/.test(back))
  ) {
    return res.redirect(back);
  }
  res.redirect('/u/' + target.username);
});

// List of followers, or of the people someone follows
function showPeople(req, res, mode) {
  const person = db
    .prepare('SELECT id, username, display_name FROM users WHERE username = ?')
    .get(req.params.username);
  if (!person) return res.status(404).send('User not found');

  const me = res.locals.currentUser;

  const sql =
    mode === 'followers'
      ? `SELECT users.id, users.username, users.display_name, users.avatar, users.bio
         FROM follows JOIN users ON users.id = follows.follower_id
         WHERE follows.followed_id = ? AND users.is_banned = 0
         ORDER BY follows.id DESC`
      : `SELECT users.id, users.username, users.display_name, users.avatar, users.bio
         FROM follows JOIN users ON users.id = follows.followed_id
         WHERE follows.follower_id = ? AND users.is_banned = 0
         ORDER BY follows.id DESC`;

  const people = db.prepare(sql).all(person.id);

  // Which of these people do *you* follow?
  const mine = new Set(
    db.prepare('SELECT followed_id FROM follows WHERE follower_id = ?').all(me.id).map((r) => r.followed_id)
  );
  people.forEach((p) => {
    p.isFollowing = mine.has(p.id);
    p.isMe = p.id === me.id;
  });

  res.render('people', {
    title: mode === 'followers' ? 'Followers' : 'Following',
    person,
    mode,
    people
  });
}

router.get('/u/:username/followers', requireLogin, (req, res) => showPeople(req, res, 'followers'));
router.get('/u/:username/following', requireLogin, (req, res) => showPeople(req, res, 'following'));

module.exports = router;