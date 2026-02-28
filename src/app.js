require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('./config/passport');
const db = require('./config/database');

const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', `${__dirname}/../views`);

// Static files
app.use(express.static(`${__dirname}/../public`));

// Body parsing
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 }, // 30 days, refreshed on each request
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/', indexRouter);
app.use('/auth', authRouter);

// Start server (verify DB connection first)
db.getConnection()
  .then((conn) => {
    conn.release();
    console.log('Connected to MySQL database');
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });
