const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false })); // lets us read form data

// Sessions: remember who is logged in
app.use(session({
  secret: 'change-this-to-any-long-random-text',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
}));

// Make the logged-in user available to every page as "currentUser"
app.use((req, res, next) => {
  res.locals.currentUser = null;
   res.locals.tagsFor = (postId) =>
    db
      .prepare('SELECT tag FROM post_tags WHERE post_id = ? ORDER BY tag')
      .all(postId)
      .map((r) => r.tag); 
  if (req.session.userId) {
    const user = db
      .prepare('SELECT id, username, role, is_banned FROM users WHERE id = ?')
      .get(req.session.userId);
    if (user && !user.is_banned) {
      res.locals.currentUser = user;
    } else {
      delete req.session.userId;
    }
  }
  next();
});

// Home
// Home: visitors see the welcome page, members see the feed (routes/feed.js)
app.get('/', (req, res, next) => {
  if (!res.locals.currentUser) return res.render('home', { title: 'Home' });
  next();
});

// Sign up
app.get('/signup', (req, res) => {
  if (res.locals.currentUser) return res.redirect('/');
  res.render('signup', { title: 'Sign up', error: null, form: {} });
});

app.post('/signup', async (req, res) => {
  const { username, email, password, confirm } = req.body;
  const form = { username, email };
  const fail = (msg) => res.render('signup', { title: 'Sign up', error: msg, form });

  if (!username || !/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return fail('Username must be 3-20 characters: letters, numbers or underscore.');
  }
  if (!email || !email.includes('@')) return fail('Please enter a valid email.');
  if (!password || password.length < 6) return fail('Password must be at least 6 characters.');
  if (password !== confirm) return fail('Passwords do not match.');

  const exists = db
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(username, email.toLowerCase());
  if (exists) return fail('That username or email is already taken.');

  const hash = await bcrypt.hash(password, 10);
  const result = db
    .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
    .run(username, email.toLowerCase(), hash);

  req.session.userId = result.lastInsertRowid;
  res.redirect('/');
});

// Log in
app.get('/login', (req, res) => {
  if (res.locals.currentUser) return res.redirect('/');
  res.render('login', { title: 'Log in', error: null, form: {} });
});

app.post('/login', async (req, res) => {
  const { login, password } = req.body;
  const form = { login };
  const fail = (msg) => res.render('login', { title: 'Log in', error: msg, form });

  const text = (login || '').trim();
  const user = db
    .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
    .get(text, text.toLowerCase());

  const ok = user && (await bcrypt.compare(password || '', user.password_hash));
  if (!ok) return fail('Wrong username/email or password.');
  if (user.is_banned) return fail('This account has been banned.');

  req.session.userId = user.id;
  res.redirect('/');
});

// Log out
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.use(require('./routes/profile'));
app.use(require('./routes/posts'));
app.use(require('./routes/feed'));
app.use(require('./routes/comments'));
app.use(require('./routes/interactions'));
app.use(require('./routes/admin'));
app.use(require('./routes/challenges'));
app.use(require('./routes/extras'));
app.use(require('./routes/follows'));
app.use(require('./routes/search'));
app.use(require('./routes/tags'));
app.listen(PORT, () => {
  console.log(`VERSA is running at http://localhost:${PORT}`);
});