const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const DB = require('./db');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists
      const userRes = await DB.query(
        'SELECT * FROM players WHERE username = $1',
        [profile.displayName]
      );

      let user;
      if (userRes.rows.length > 0) {
        user = userRes.rows[0];
      } else {
        // If not, insert new player
        const insertRes = await DB.query(
          'INSERT INTO players (username, coins) VALUES ($1, $2) RETURNING *',
          [profile.displayName, 0]
        );
        user = insertRes.rows[0];
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id); // store only the id in session
});

passport.deserializeUser(async (id, done) => {
  try {
    const res = await DB.query('SELECT * FROM players WHERE id = $1', [id]);
    done(null, res.rows[0]);
  } catch (err) {
    done(err, null);
  }
});
