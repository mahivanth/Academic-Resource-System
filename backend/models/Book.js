const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    author: {
        type: String,
        required: true,
        trim: true
    },
    isbn: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        enum: ['Science', 'Mathematics', 'Engineering', 'Arts', 'Literature', 'History', 'Computer Science', 'Medicine', 'Law', 'Other'],
        default: 'Other'
    },
    description: {
        type: String,
        trim: true
    },
    totalCopies: {
        type: Number,
        default: 1,
        min: 0
    },
    availableCopies: {
        type: Number,
        default: 1,
        min: 0
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Book', BookSchema);
