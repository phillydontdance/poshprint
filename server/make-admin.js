// Run this script to set a Firebase user as admin
// Usage: node server/make-admin.js <firebase-uid>

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data.json');

const uid = process.argv[2];
if (!uid) {
  console.log('Usage: node server/make-admin.js <firebase-uid>');
  console.log('');
  console.log('To find your Firebase UID:');
  console.log('1. Log in to the app');
  console.log('2. Check the Firebase Console → Authentication → Users');
  console.log('3. Copy the User UID');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const user = data.users.find(u => u.firebaseUid === uid);

if (user) {
  user.role = 'admin';
  console.log(`✅ Updated "${user.name}" (${user.email}) to admin role`);
} else {
  // Create an admin entry
  data.users.push({
    firebaseUid: uid,
    email: 'admin@poshprint.com',
    role: 'admin',
    name: 'Admin User',
    createdAt: new Date().toISOString(),
  });
  console.log(`✅ Created new admin user with UID: ${uid}`);
  console.log('   Update the email/name in server/data.json if needed.');
}

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log('🔄 Restart the server for changes to take effect.');
