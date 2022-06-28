// import { join, dirname } from 'path';
// import { Low, JSONFile } from 'lowdb';

const { join } = require('path');
const { Low, JSONFile } = require('lowdb-node');
// import { fileURLToPath } from 'url';

// Use JSON file for storage
const file = join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);

module.exports = async function () {
  await db.read();
  db.data ||= { states: [] };
  // db.write();
  // console.log(db.data);
  return db;
};
