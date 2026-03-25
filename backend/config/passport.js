const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Load User Model
const User = require('../models/User');

module.exports = function (passport) {
    // Local Strategy
    passport.use(new LocalStrategy({ usernameField: 'username' }, (username, password, done) => {
        const searchName = username.toLowerCase().trim();
        // Match User by email, rollNo, facultyId, or username
        User.findOne({
            $or: [
                { email: searchName },
                { username: searchName },
                { rollNo: searchName },
                { facultyId: searchName }
            ]
        }).then(user => {
            if (!user) {
                return done(null, false, { message: 'That username is not registered' });
            }

            // Match Password
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) throw err;
                if (isMatch) {
                    return done(null, user);
                } else {
                    return done(null, false, { message: 'Password incorrect' });
                }
            });
        });
    }));

    // Google Strategy
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user already exists
            let user = await User.findOne({ googleId: profile.id });

            if (user) {
                return done(null, user);
            }

            // If not found by googleId, check by email
            const email = profile.emails[0].value.toLowerCase().trim();
            user = await User.findOne({ email: email });
            if (user) {
                // Link google account to existing local account
                user.googleId = profile.id;
                user.profilePic = profile.photos[0].value;
                await user.save();
                return done(null, user);
            }

            // If still not found, do NOT create user. Return error.
            return done(null, false, { message: 'Your email is not registered. Please contact an admin.' });

        } catch (err) {
            console.error(err);
            return done(err, null);
        }
    }));

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser((id, done) => {
        User.findById(id).then(user => {
            done(null, user);
        }).catch(err => {
            done(err, null);
        });
    });
};
