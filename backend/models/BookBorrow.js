const mongoose = require('mongoose');

const BookBorrowSchema = new mongoose.Schema({
    book: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        required: true
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    borrowDate: {
        type: Date
    },
    dueDate: {
        type: Date
    },
    returnDate: {
        type: Date
    },
    status: {
        type: String,
        enum: ['pending', 'borrowed', 'returned', 'rejected'],
        default: 'pending'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    notes: {
        type: String
    },
    requestedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('BookBorrow', BookBorrowSchema);
