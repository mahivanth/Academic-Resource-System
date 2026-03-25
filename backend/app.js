require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');

const app = express();

// Database Connection & Server Start
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB Connected');
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server started on port ${PORT}`);
        });
    })
    .catch(err => console.error('MongoDB Connection Error:', err));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend/public')));
app.set('views', path.join(__dirname, '../frontend/views'));
app.set('view engine', 'ejs');

// Express Session
app.use(session({
    secret: process.env.SESSION_SECRET || "fallback_secret_key",
    resave: false,
    saveUninitialized: false
}));

// Passport Config
require('./config/passport')(passport); // We need to create this
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
const Notification = require('./models/Notification'); // Added Notification model

app.use(async (req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.user || null;

    if (req.user && req.user.role !== 'admin') {
        try {
            res.locals.unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
            res.locals.recentNotifications = await Notification.find({ user: req.user._id })
                .sort({ createdAt: -1 })
                .limit(5);
            
            // Fetch unread announcements count
            const Announcement = require('./models/Announcement');
            res.locals.unreadAnnouncementsCount = await Announcement.countDocuments({
                isActive: true,
                $or: [
                    { targetRoles: 'all' },
                    { targetRoles: req.user.role }
                ],
                readBy: { $ne: req.user._id }
            });
        } catch (err) {
            res.locals.unreadCount = 0;
            res.locals.recentNotifications = [];
            res.locals.unreadAnnouncementsCount = 0;
        }
    } else {
        res.locals.unreadCount = 0;
        res.locals.recentNotifications = [];
        res.locals.unreadAnnouncementsCount = 0;
    }

    next();
});

app.use('/', require('./routes/index'));
app.use('/notifications', require('./routes/notifications'));
app.use('/library', require('./routes/library'));

// Removed old app.listen to avoid multiple starts
