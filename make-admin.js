const db = require('./db');

const username = process.argv[2];
if (!username) {
  console.log('Usage: node make-admin.js yourusername');
  process.exit(1);
}

const result = db.prepare("UPDATE users SET role = 'admin' WHERE username = ?").run(username);
console.log(result.changes ? `${username} is now an admin.` : `No user named "${username}" found.`);
