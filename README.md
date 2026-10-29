# VERSA

A colorful, artistic community website where people share **poems**, **artwork** and **questions**, and respond to each other with comments and votes. Think of it as Quora with a creative side.

VERSA is a learning project, written in English. Every user needs an account and must log in to use it.

## Features

**Members can**

- Sign up, log in and log out
- Edit a profile with a display name, a bio and an avatar picture
- Visit any member's profile to see their posts, stats and followers
- Publish three kinds of posts, with optional tags:
  - **Question**: a title and details, answered by others with respectful opinions
  - **Artwork**: an image and a title, with an optional description
  - **Poem**: a title and the poem text (line breaks are kept)
- Browse the home feed, with tabs: All, Following, Questions, Artwork, Poems
- Comment on posts (comments on questions are shown as answers)
- Upvote and downvote posts
- Save posts to a personal Saved page
- Report posts that break the community rules
- Repost other people's posts, and mark posts as "interested" or "not interested" (not interested hides a post from your feed)
- Follow other members, with followers and following lists
- Search for posts, members and tags, and browse posts by tag
- See the latest comments other people left on their own posts
- Join **drawing challenges**: submit one entry, vote for one entry, and see the winner when the deadline passes

**Admins get a private dashboard with**

- Member, post, comment and report counts
- Sign-ups per day (last 14 days)
- Most active members and most popular posts
- Posts by type
- A Posts page with hide, unhide and delete for any post, reported or not
- Reported posts, with tools to hide, unhide, delete or dismiss them
- A member list with ban and unban
- Challenge creation, with rules and a deadline

The layout also works on phones, with a menu button for the navigation bar.

## Roadmap

- [x] Accounts and profiles
- [x] Posts, home feed, comments, votes, bookmarks and reports
- [x] Admin dashboard and moderation
- [x] Drawing challenges with votes and a winner
- [x] Reposts, interested / not interested, follows, search and tags
- [ ] Night mode and a smoother, more fluid design
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
git clone https://github.com/Repeka/VERSA.git
cd VERSA

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
VERSA/
├── server.js            # Starts the app, sessions, sign up and log in
├── db.js                # Opens the SQLite database and creates the tables
├── make-admin.js        # Small script that turns a user into an admin
├── routes/
│   ├── profile.js       # Profile pages and avatar upload
│   ├── posts.js         # Create, view and delete posts, with tags
│   ├── feed.js          # Home feed, Following tab and filter tabs
│   ├── comments.js      # Comments and answers
│   ├── interactions.js  # Votes, bookmarks and reports
│   ├── extras.js        # Reposts and interested / not interested
│   ├── follows.js       # Follow, followers and following lists
│   ├── search.js        # Search for posts, members and tags
│   ├── tags.js          # Tag pages and the list of all tags
│   ├── challenges.js    # Drawing challenges, entries and votes
│   └── admin.js         # Admin dashboard and moderation
├── views/               # EJS pages
│   └── partials/        # Shared pieces: header, footer, post card, admin menu
└── public/
    ├── css/style.css    # All styling
    └── uploads/         # Avatars and images (created automatically, not in Git)
```

## Database tables

| Area | Tables |
| --- | --- |
| Members | `users`, `follows` |
| Posts | `posts` (with a `type` column for question, artwork or poem), `post_tags`, `comments` |
| Interaction | `votes`, `bookmarks`, `reports`, `reposts`, `interests` |
| Challenges | `challenges`, `submissions`, `challenge_votes` |

## Notes

- This is a learning project, not a production-ready site.
- Before putting VERSA on the internet, change the session secret in `server.js` and keep it out of the repository, for example in an environment variable.
- Login sessions are kept in memory, so everyone is logged out when the server restarts.
- The database and uploaded images are not part of the repository, so each copy of the project starts empty.