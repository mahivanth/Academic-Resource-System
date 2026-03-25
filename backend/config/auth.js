module.exports = {
    ensureAuthenticated: function (req, res, next) {
        if (req.isAuthenticated()) {
            if (req.user.isBlocked) {
                req.logout((err) => {
                    req.flash('error_msg', 'Your account has been blocked by an administrator.');
                    res.redirect('/users/login');
                });
                return;
            }
            return next();
        }
        res.redirect('/users/login');
    },
    forwardAuthenticated: function (req, res, next) {
        if (!req.isAuthenticated()) {
            return next();
        }
        res.redirect('/dashboard');
    },
    ensureAdmin: function (req, res, next) {
        if (req.isAuthenticated() && req.user.role === 'admin') {
            return next();
        }
        req.flash('error_msg', 'Not Authorized');
        res.redirect('/dashboard');
    },
    ensureFaculty: function (req, res, next) {
        if (req.isAuthenticated() && (req.user.role === 'faculty' || req.user.role === 'admin')) {
            return next();
        }
        req.flash('error_msg', 'Not Authorized');
        res.redirect('/dashboard');
    }
};
