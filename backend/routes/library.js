const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const Book = require('../models/Book');
const BookBorrow = require('../models/BookBorrow');
const BookReservation = require('../models/BookReservation');
const Notification = require('../models/Notification');

// Helper: is the user a librarian or admin?
function isLibrarianOrAdmin(user) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (
        user.role === 'faculty' &&
        user.facultyType === 'non-teaching' &&
        user.department &&
        user.department.toLowerCase().includes('librar')
    ) return true;
    return false;
}

// ─────────────────────────────────────────────────────────
// GET /library  –  Student book catalog
// ─────────────────────────────────────────────────────────
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const search = req.query.search || '';
        const category = req.query.category || '';

        const query = {};
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { author: { $regex: search, $options: 'i' } },
                { isbn: { $regex: search, $options: 'i' } }
            ];
        }
        if (category) query.category = category;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const books = await Book.find(query).sort({ title: 1 }).skip(skip).limit(limit);
        const totalBooks = await Book.countDocuments(query);
        const totalPages = Math.ceil(totalBooks / limit);

        // Get current user's borrow requests to know which books they already requested
        let myBorrows = [];
        if (req.user.role === 'student') {
            myBorrows = await BookBorrow.find({
                student: req.user._id,
                status: { $in: ['pending', 'borrowed'] }
            }).select('book').lean();
        }
        const borrowedBookIds = myBorrows.map(b => b.book.toString());

        if (req.query.ajax === 'true') {
            return res.render('library/partials/book_cards', {
                user: req.user,
                books,
                borrowedBookIds
            });
        }

        const categories = ['Science', 'Mathematics', 'Engineering', 'Arts', 'Literature', 'History', 'Computer Science', 'Medicine', 'Law', 'Other'];

        res.render('library/index', {
            user: req.user,
            books,
            borrowedBookIds,
            categories,
            search,
            selectedCategory: category,
            isLibrarianOrAdmin: isLibrarianOrAdmin(req.user),
            page,
            totalPages
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to load library.');
        res.redirect('/dashboard');
    }
});

// ─────────────────────────────────────────────────────────
// GET /library/manage  –  Librarian/Admin book management
// ─────────────────────────────────────────────────────────
router.get('/manage', ensureAuthenticated, async (req, res) => {
    if (!isLibrarianOrAdmin(req.user)) {
        req.flash('error_msg', 'Access denied.');
        return res.redirect('/library');
    }
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const books = await Book.find().sort({ title: 1 }).skip(skip).limit(limit);
        const totalBooks = await Book.countDocuments();
        const totalPages = Math.ceil(totalBooks / limit);

        if (req.query.ajax === 'true') {
            return res.render('library/partials/book_rows', { books });
        }

        const categories = ['Science', 'Mathematics', 'Engineering', 'Arts', 'Literature', 'History', 'Computer Science', 'Medicine', 'Law', 'Other'];
        res.render('library/manage', { user: req.user, books, categories, page, totalPages });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to load management page.');
        res.redirect('/library');
    }
});

// ─────────────────────────────────────────────────────────
// GET /library/borrows  –  Librarian/Admin borrow requests page
// ─────────────────────────────────────────────────────────
router.get('/borrows', ensureAuthenticated, async (req, res) => {
    if (!isLibrarianOrAdmin(req.user)) {
        req.flash('error_msg', 'Access denied.');
        return res.redirect('/library');
    }
    try {
        const borrows = await BookBorrow.find()
            .populate('book', 'title author')
            .populate('student', 'name rollNo email')
            .populate('approvedBy', 'name')
            .sort({ requestedAt: -1 });
        res.render('library/borrows', { user: req.user, borrows });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to load borrow requests.');
        res.redirect('/library/borrows');
    }
});

// ─────────────────────────────────────────────────────────
// POST /library/books  –  Add a book
// ─────────────────────────────────────────────────────────
router.post('/books', ensureAuthenticated, async (req, res) => {
    if (!isLibrarianOrAdmin(req.user)) {
        req.flash('error_msg', 'Access denied.');
        return res.redirect('/library');
    }
    try {
        const { title, author, isbn, category, description, totalCopies } = req.body;
        const copies = parseInt(totalCopies) || 1;
        await Book.create({
            title, author, isbn, category, description,
            totalCopies: copies,
            availableCopies: copies,
            addedBy: req.user._id
        });
        req.flash('success_msg', `Book "${title}" added successfully.`);
        res.redirect('/library/manage');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to add book.');
        res.redirect('/library/manage');
    }
});

// ─────────────────────────────────────────────────────────
// POST /library/books/:id/edit  –  Edit a book
// ─────────────────────────────────────────────────────────
router.post('/books/:id/edit', ensureAuthenticated, async (req, res) => {
    if (!isLibrarianOrAdmin(req.user)) {
        req.flash('error_msg', 'Access denied.');
        return res.redirect('/library');
    }
    try {
        const { title, author, isbn, category, description, totalCopies } = req.body;
        const book = await Book.findById(req.params.id);
        if (!book) { req.flash('error_msg', 'Book not found.'); return res.redirect('/library/manage'); }

        const diff = parseInt(totalCopies) - book.totalCopies;
        book.title = title;
        book.author = author;
        book.isbn = isbn;
        book.category = category;
        book.description = description;
        book.totalCopies = parseInt(totalCopies);
        book.availableCopies = Math.max(0, book.availableCopies + diff);
        await book.save();

        req.flash('success_msg', 'Book updated.');
        res.redirect('/library/manage');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to update book.');
        res.redirect('/library/manage');
    }
});

// ─────────────────────────────────────────────────────────
// POST /library/books/:id/delete  –  Delete a book
// ─────────────────────────────────────────────────────────
router.post('/books/:id/delete', ensureAuthenticated, async (req, res) => {
    if (!isLibrarianOrAdmin(req.user)) {
        req.flash('error_msg', 'Access denied.');
        return res.redirect('/library');
    }
    try {
        await Book.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Book removed from library.');
        res.redirect('/library/manage');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to delete book.');
        res.redirect('/library/manage');
    }
});

// ─────────────────────────────────────────────────────────
// POST /library/books/:id/borrow  –  Student requests borrow
// ─────────────────────────────────────────────────────────
router.post('/books/:id/borrow', ensureAuthenticated, async (req, res) => {
    if (req.user.role !== 'student') {
        req.flash('error_msg', 'Only students can borrow books.');
        return res.redirect('/library');
    }
    try {
        const book = await Book.findById(req.params.id);
        if (!book) { req.flash('error_msg', 'Book not found.'); return res.redirect('/library'); }
        if (book.availableCopies < 1) { req.flash('error_msg', 'No copies available right now.'); return res.redirect('/library'); }

        // Check if already has a pending/active borrow for this book
        const existing = await BookBorrow.findOne({
            book: book._id, student: req.user._id, status: { $in: ['pending', 'borrowed'] }
        });
        if (existing) { req.flash('error_msg', 'You already have a pending or active borrow for this book.'); return res.redirect('/library'); }

        await BookBorrow.create({ book: book._id, student: req.user._id });
        req.flash('success_msg', `Borrow request for "${book.title}" submitted! Waiting for librarian approval.`);
        res.redirect('/library');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to submit borrow request.');
        res.redirect('/library');
    }
});

// ─────────────────────────────────────────────────────────
// POST /library/borrows/:id/approve  –  Librarian/Admin approves borrow
// ─────────────────────────────────────────────────────────
router.post('/borrows/:id/approve', ensureAuthenticated, async (req, res) => {
    if (!isLibrarianOrAdmin(req.user)) {
        req.flash('error_msg', 'Only the librarian or admin can approve borrows.');
        return res.redirect('/library/manage');
    }
    try {
        const borrow = await BookBorrow.findById(req.params.id).populate('book').populate('student');
        if (!borrow) { req.flash('error_msg', 'Borrow request not found.'); return res.redirect('/library/manage'); }
        if (borrow.status !== 'pending') { req.flash('error_msg', 'Request is no longer pending.'); return res.redirect('/library/manage'); }

        if (borrow.book.availableCopies < 1) {
            req.flash('error_msg', 'No copies available to approve.');
            return res.redirect('/library/manage');
        }

        const borrowDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14); // 2-week loan period

        borrow.status = 'borrowed';
        borrow.borrowDate = borrowDate;
        borrow.dueDate = dueDate;
        borrow.approvedBy = req.user._id;
        await borrow.save();

        borrow.book.availableCopies -= 1;
        await borrow.book.save();

        // Update reservation status if this student had a reservation
        await BookReservation.findOneAndUpdate(
            { student: borrow.student._id, book: borrow.book._id, status: 'notified' },
            { status: 'completed' }
        );

        // Notify student
        await Notification.create({
            user: borrow.student._id,
            message: `Your borrow request for "${borrow.book.title}" has been approved! Please collect the book from the library. Due date: ${dueDate.toDateString()}.`
        });

        req.flash('success_msg', `Approved borrow for ${borrow.student.name}.`);
        res.redirect('/library/borrows');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to approve borrow.');
        res.redirect('/library/borrows');
    }
});

// ─────────────────────────────────────────────────────────
// POST /library/borrows/:id/reject  –  Librarian/Admin rejects borrow
// ─────────────────────────────────────────────────────────
router.post('/borrows/:id/reject', ensureAuthenticated, async (req, res) => {
    if (!isLibrarianOrAdmin(req.user)) {
        req.flash('error_msg', 'Access denied.');
        return res.redirect('/library/manage');
    }
    try {
        const borrow = await BookBorrow.findById(req.params.id).populate('book').populate('student');
        if (!borrow) { req.flash('error_msg', 'Borrow request not found.'); return res.redirect('/library/manage'); }

        borrow.status = 'rejected';
        await borrow.save();

        await Notification.create({
            user: borrow.student._id,
            message: `Your borrow request for "${borrow.book.title}" was not approved. Please contact the library for more information.`
        });

        req.flash('success_msg', 'Borrow request rejected.');
        res.redirect('/library/borrows');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to reject borrow.');
        res.redirect('/library/borrows');
    }
});

// ─────────────────────────────────────────────────────────
// POST /library/borrows/:id/return  –  Librarian/Admin marks returned
// ─────────────────────────────────────────────────────────
router.post('/borrows/:id/return', ensureAuthenticated, async (req, res) => {
    if (!isLibrarianOrAdmin(req.user)) {
        req.flash('error_msg', 'Access denied.');
        return res.redirect('/library/manage');
    }
    try {
        const borrow = await BookBorrow.findById(req.params.id).populate('book').populate('student');
        if (!borrow) { req.flash('error_msg', 'Borrow not found.'); return res.redirect('/library/manage'); }
        if (borrow.status !== 'borrowed') { req.flash('error_msg', 'This book is not currently borrowed.'); return res.redirect('/library/manage'); }

        borrow.status = 'returned';
        borrow.returnDate = new Date();
        await borrow.save();

        borrow.book.availableCopies += 1;
        await borrow.book.save();

        await Notification.create({
            user: borrow.student._id,
            message: `Thank you for returning "${borrow.book.title}" to the library!`
        });

        // Check if there are any waiting reservations for this book
        const nextReservation = await BookReservation.findOne({ book: borrow.book._id, status: 'waiting' }).sort({ createdAt: 1 });
        if (nextReservation) {
            req.flash('success_msg', `Book returned. NOTE: There are students waiting for this book! Check the Reservations page.`);
        } else {
            req.flash('success_msg', `Book "${borrow.book.title}" marked as returned.`);
        }
        res.redirect('/library/manage');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to process return.');
        res.redirect('/library/manage');
    }
});

// ─────────────────────────────────────────────────────────
// Feature 10: Book Reservation — student reserves when unavailable
// ─────────────────────────────────────────────────────────
router.post('/books/:id/reserve', ensureAuthenticated, async (req, res) => {
    if (req.user.role !== 'student') {
        req.flash('error_msg', 'Only students can reserve books.');
        return res.redirect('/library');
    }
    try {
        const book = await Book.findById(req.params.id);
        if (!book) { req.flash('error_msg', 'Book not found.'); return res.redirect('/library'); }
        if (book.availableCopies > 0) {
            req.flash('error_msg', 'Book is available — you can borrow it directly!');
            return res.redirect('/library');
        }

        const existing = await BookReservation.findOne({
            book: book._id, student: req.user._id, status: { $in: ['waiting', 'notified'] }
        });
        if (existing) {
            req.flash('error_msg', 'You already have a reservation for this book.');
            return res.redirect('/library');
        }

        const queueCount = await BookReservation.countDocuments({ book: book._id, status: 'waiting' });
        await BookReservation.create({
            book: book._id, student: req.user._id, queuePosition: queueCount + 1
        });
        req.flash('success_msg', `Reserved! You are #${queueCount + 1} in the queue for "${book.title}".`);
        res.redirect('/library');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to reserve book.');
        res.redirect('/library');
    }
});

// GET /library/reservations — librarian sees all waiting reservations
router.get('/reservations', ensureAuthenticated, async (req, res) => {
    if (!isLibrarianOrAdmin(req.user)) {
        req.flash('error_msg', 'Access denied.');
        return res.redirect('/library');
    }
    try {
        const reservations = await BookReservation.find({ status: { $in: ['waiting', 'notified'] } })
            .populate('book', 'title author availableCopies')
            .populate('student', 'name email rollNo')
            .sort({ createdAt: 1 });
        res.render('library/reservations', { user: req.user, reservations });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to load reservations.');
        res.redirect('/library/manage');
    }
});

// POST /library/reservations/:id/notify — librarian notifies student
router.post('/reservations/:id/notify', ensureAuthenticated, async (req, res) => {
    if (!isLibrarianOrAdmin(req.user)) {
        req.flash('error_msg', 'Access denied.');
        return res.redirect('/library/reservations');
    }
    try {
        const reservation = await BookReservation.findById(req.params.id).populate('book').populate('student');
        if (!reservation) { req.flash('error_msg', 'Reservation not found.'); return res.redirect('/library/reservations'); }
        reservation.status = 'notified';
        reservation.notifiedAt = new Date();
        await reservation.save();

        await Notification.create({
            user: reservation.student._id,
            message: `📚 Good news! The book "${reservation.book.title}" is now available. Please visit the library to borrow it.`
        });

        req.flash('success_msg', `${reservation.student.name} has been notified.`);
        res.redirect('/library/reservations');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to notify student.');
        res.redirect('/library/reservations');
    }
});

// ─────────────────────────────────────────────────────────
// Feature 9: Low Stock Alert
// ─────────────────────────────────────────────────────────
router.get('/low-stock', ensureAuthenticated, async (req, res) => {
    if (!isLibrarianOrAdmin(req.user)) {
        req.flash('error_msg', 'Access denied.');
        return res.redirect('/library');
    }
    try {
        const threshold = parseInt(req.query.threshold) || 2;
        const lowStockBooks = await Book.find({ availableCopies: { $lte: threshold } }).sort({ availableCopies: 1 });
        res.render('library/low_stock', { user: req.user, books: lowStockBooks, threshold });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to load low stock list.');
        res.redirect('/library/manage');
    }
});

module.exports = router;
