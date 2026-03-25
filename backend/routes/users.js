const express = require('express');
const router = express.Router();
const passport = require('passport');

// Login Page
router.get('/login', (req, res) => res.render('login'));

// Login Handle
router.post('/login', (req, res, next) => {
    passport.authenticate('local', {
        successRedirect: '/dashboard',
        failureRedirect: '/users/login',
        failureFlash: true
    })(req, res, next);
});

// Logout Handle
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/users/login');
    });
});

// Change Password Handle
// Verify Password Handle (AJAX)
router.post('/verify-password', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const { oldPassword } = req.body;
    const bcrypt = require('bcryptjs');
    const User = require('../models/User');

    try {
        const user = await User.findById(req.user._id);
        const isMatch = await bcrypt.compare(oldPassword, user.password);

        if (isMatch) {
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Incorrect password' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Change Password Handle (AJAX or Form)
router.post('/change-password', async (req, res) => {
    if (!req.isAuthenticated()) {
        // If it's an AJAX request, return JSON
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        return res.redirect('/users/login');
    }

    const { newPassword } = req.body;
    const bcrypt = require('bcryptjs');
    const User = require('../models/User');

    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        await User.findByIdAndUpdate(req.user._id, { password: hash });

        // If it's an AJAX request, return JSON
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({ success: true, message: 'Password changed successfully' });
        }

        req.flash('success_msg', 'Password changed successfully');
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ success: false, message: 'Error changing password' });
        }
        req.flash('error_msg', 'Error changing password');
        res.redirect('/dashboard');
    }
});

module.exports = router;
