const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: false // Email will be username for local, or just google name
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String, // Hashed
        required: function () { return !this.googleId; }
    },
    googleId: {
        type: String
    },
    profilePic: {
        type: String
    },
    role: {
        type: String,
        enum: ['admin', 'faculty', 'student'],
        default: 'student'
    },
    name: {
        type: String,
        required: true
    },
    // Specific fields
    rollNo: {
        type: String // For students
    },
    year: {
        type: Number // For students (1, 2, 3, 4)
    },
    facultyId: {
        type: String // For faculty
    },
    facultyType: {
        type: String, // teaching, non-teaching, intern
        enum: ['teaching', 'non-teaching', 'intern']
    },
    department: {
        type: String
    },
    date: {
        type: Date,
        default: Date.now
    },
    isBlocked: {
        type: Boolean,
        default: false
    }
});

const User = mongoose.model('User', UserSchema);
module.exports = User;
