# VERSA

A colorful, artistic community website where people share **poems**, **artwork** and **questions**, and respond to each other with comments and votes. Think of it as Quora with a creative side.

VERSA is a learning project, written in English. Every user needs an account and must log in to use it.

## Features

**Members can**

- Sign up, log in and log out
- Edit a profile with a display name, a bio and an avatar picture
- Publish three kinds of posts:
  - **Question**: a title and details, answered by others with respectful opinions
  - **Artwork**: an image and a title, with an optional description
  - **Poem**: a title and the poem text (line breaks are kept)
- Browse a home feed of the newest posts, with filter tabs: All, Questions, Artwork, Poems
- Comment on posts (comments on questions are shown as answers)
- Upvote and downvote posts
- Save posts to a personal Saved page
- Report posts that break the community rules

**Admins get a private dashboard with**

- Member, post, comment and report counts
- Sign-ups per day (last 14 days)
- Most active members and most popular posts
- Posts by type
- Reported posts, with tools to hide, unhide, delete or dismiss them
- A member list with ban and unban

## Roadmap

- [ ] Drawing challenges with rules, a deadline, entries, votes and a winner
- [ ] Reposts, "interested / not interested", follows, search and tags
- [ ] Notifications and badges

## Tech stack

| Part | Tool |
| --- | --- |
| Server | Node.js + Express |
| Database | SQLite (`better-sqlite3`), a single file |
| Pages | EJS templates with plain HTML, CSS and JavaScript |
| Passwords | bcrypt |
| Login sessions | express-session |
| Image uploads | multer |

## Getting started

You need [Node.js](https://nodejs.org) (the LTS version) installed.

```bash
# 1. Download the project
git clone https://github.com/Repeka/versa.git
cd versa

# 2. Install the dependencies
npm install

# 3. Start the server
node server.js
```

Then open <http://localhost:3000> in your browser.

The database file (`versa.db`) and the upload folders are created automatically the first time the server runs.

### Making yourself an admin

1. Sign up for an account on the website.
2. Stop the server, then run this in the project folder, using your own username (it is case-sensitive):

```bash
node make-admin.js yourusername
```

3. Start the server again. An **Admin** link now appears in the navigation bar.

## Project structure

```
versa/
├── server.js          # Starts the app, sessions, sign up and log in
├── db.js              # Opens the SQLite database and creates the tables
├── make-admin.js      # Small script that turns a user into an admin
├── routes/
│   ├── profile.js     # Profile pages and avatar upload
│   ├── posts.js       # Create, view and delete posts
│   ├── feed.js        # Home feed with filter tabs
│   ├── comments.js    # Comments and answers
│   ├── interactions.js# Votes, bookmarks and reports
│   └── admin.js       # Admin dashboard and moderation
├── views/             # EJS pages
│   └── partials/      # Shared pieces: header, footer, post card, admin menu
└── public/
    ├── css/style.css  # All styling
    └── uploads/       # Avatars and artwork (created automatically, not in Git)
```

## Database tables

`users`, `posts` (with a `type` column for question, artwork or poem), `comments`, `votes`, `bookmarks` and `reports`. Challenge tables will be added later.

## Notes

- This is a learning project, not a production-ready site.
- Before putting VERSA on the internet, change the session secret in `server.js` and keep it out of the repository, for example in an environment variable.
- Login sessions are kept in memory, so everyone is logged out when the server restarts.
- The database and uploaded images are not part of the repository, so each copy of the project starts empty.