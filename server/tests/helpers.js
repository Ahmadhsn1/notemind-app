const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../models/User');
const Note = require('../models/Note');
const NoteVersion = require('../models/NoteVersion');
const Flashcard = require('../models/Flashcard');
const Resurface = require('../models/Resurface');
const Notification = require('../models/Notification');
const AdminAuditLog = require('../models/AdminAuditLog');
const AiUsage = require('../models/AiUsage');
const PasswordResetToken = require('../models/PasswordResetToken');

// An in-memory MongoDB rather than a shared test database: the suite can run
// on any machine and in CI with no external service, and every run starts
// from a known-empty state.
let mongod;

const startDb = async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
};

const stopDb = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod?.stop();
};

const ALL_MODELS = [User, Note, NoteVersion, Flashcard, Resurface, Notification, AdminAuditLog, AiUsage, PasswordResetToken];

const clearDb = async () => {
  await Promise.all(ALL_MODELS.map((model) => model.deleteMany({})));
};

let counter = 0;
const createUser = async (overrides = {}) => {
  counter += 1;
  return User.create({
    name: `User ${counter}`,
    email: `user${counter}@test.invalid`,
    // Real bcrypt hashes are slow and irrelevant to most of these tests; the
    // ones that exercise password checking hash their own.
    password: '$2b$10$abcdefghijklmnopqrstuv',
    ...overrides,
  });
};

// Mints the same token shape authController.generateToken produces.
const tokenFor = (user) => jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });

const auth = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

const createNote = async (user, overrides = {}) =>
  Note.create({
    user: user._id,
    title: 'A note',
    body: 'note body',
    contentHtml: '<p>note body</p>',
    ...overrides,
  });

module.exports = { startDb, stopDb, clearDb, createUser, createNote, tokenFor, auth };
