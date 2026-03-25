const express = require('express');
const passport = require('passport');
const router = express.Router();

// @desc    Auth with Google
// @route   GET /auth/google
router.get("/google",
  passport.authenticate("google", {
    scope: ["profile", "email"]
  })
);

// @desc    Google auth callback
// @route   GET /auth/google/callback
router.get("/google/callback",
  passport.authenticate("google", {
    successRedirect: "/dashboard",
    failureRedirect: "/users/login"
  })
);

module.exports = router;
