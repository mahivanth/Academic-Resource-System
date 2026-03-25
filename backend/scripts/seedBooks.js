const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Book = require('../models/Book');

const books = [
    // Zone 1 — Science
    { title: 'A Brief History of Time', author: 'Stephen Hawking', isbn: '978-0-553-38016-3', category: 'Science', description: 'Explores the universe, time, and black holes in accessible language.', totalCopies: 3, availableCopies: 3 },
    { title: 'The Selfish Gene', author: 'Richard Dawkins', isbn: '978-0-19-857519-1', category: 'Science', description: 'A ground-breaking book on evolutionary biology and genetics.', totalCopies: 2, availableCopies: 2 },
    { title: 'Cosmos', author: 'Carl Sagan', isbn: '978-0-345-53943-4', category: 'Science', description: 'A journey through the universe and the history of astronomy.', totalCopies: 2, availableCopies: 2 },

    // Zone 2 — Computer Science
    { title: 'Clean Code', author: 'Robert C. Martin', isbn: '978-0-13-235088-4', category: 'Computer Science', description: 'A handbook of agile software craftsmanship and best practices.', totalCopies: 4, availableCopies: 4 },
    { title: 'Introduction to Algorithms', author: 'Cormen, Leiserson, Rivest & Stein', isbn: '978-0-262-03384-8', category: 'Computer Science', description: 'The definitive reference for algorithm design and analysis.', totalCopies: 3, availableCopies: 3 },
    { title: 'The Pragmatic Programmer', author: 'David Thomas & Andrew Hunt', isbn: '978-0-13-595705-9', category: 'Computer Science', description: 'Essential lessons for becoming an effective software developer.', totalCopies: 2, availableCopies: 2 },

    // Zone 3 — Mathematics
    { title: 'Principia Mathematica', author: 'Bertrand Russell', isbn: '978-0-521-09187-0', category: 'Mathematics', description: 'Foundational work on mathematical logic and set theory.', totalCopies: 2, availableCopies: 2 },
    { title: 'The Art of Problem Solving Vol.1', author: 'Richard Rusczyk', isbn: '978-0-977-27420-9', category: 'Mathematics', description: 'Classic problem-solving strategies for olympiad mathematics.', totalCopies: 3, availableCopies: 3 },
    { title: 'Gödel, Escher, Bach', author: 'Douglas Hofstadter', isbn: '978-0-465-02656-2', category: 'Mathematics', description: 'An exploration of meaning, self-reference, and formal systems.', totalCopies: 2, availableCopies: 2 },
];

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    const inserted = await Book.insertMany(books);
    console.log(`✅ Inserted ${inserted.length} books across 3 zones:`);
    console.log('  • Zone 1 – Science (3 books)');
    console.log('  • Zone 2 – Computer Science (3 books)');
    console.log('  • Zone 3 – Mathematics (3 books)');
    await mongoose.disconnect();
})();
