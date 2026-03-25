const mongoose = require('mongoose');

const FineSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    borrow: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BookBorrow',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        default: 0
    },
    perDayRate: {
        type: Number,
        default: 2  // ₹2 per day
    },
    daysOverdue: {
        type: Number,
        default: 0
    },
    paid: {
        type: Boolean,
        default: false
    },
    paidAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Fine', FineSchema);
