const mongoose = require('mongoose');

const BookReservationSchema = new mongoose.Schema({
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
    status: {
        type: String,
        enum: ['waiting', 'notified', 'fulfilled', 'cancelled'],
        default: 'waiting'
    },
    queuePosition: {
        type: Number,
        default: 1
    },
    notifiedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('BookReservation', BookReservationSchema);
