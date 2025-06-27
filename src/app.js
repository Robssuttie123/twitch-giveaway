const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
require('dotenv').config();

const io = require('./server'); // import it from server.js

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const app = express();
const overlayRoutes = require('./routes/overlay');
app.use('/', overlayRoutes);
app.use(express.static('public'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.get('/privacy', (req, res) => {
  res.render('privacy');
});

app.use(passport.initialize());
app.use(passport.session());

app.use('/', authRoutes);
app.use('/', dashboardRoutes);

app.get('/', (req, res) => {
  res.render('home', { user: req.user });
});

app.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
	res.clearCookie('connect.sid');
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).send('<h1>Internal Server Error</h1><pre>' + err.stack + '</pre>');
});

module.exports = app;
