// server.js
const express = require('express');
const app = express();
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const port = process.env.PORT || 3001;

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 10 } // 10MB max
});

// Express setup
app.set('view engine', 'ejs');
app.set('views', 'views');
app.use(express.urlencoded({ extended: false }));
app.use("/uploads", express.static('uploads'));

// MongoDB setup
const client = new MongoClient(process.env.MONGODB_URI);
let bookingCollection;

async function startServer() {
  try {
    await client.connect();
    console.log('MongoDB connected successfully');

    const db = client.db('MovieDataBase');
    bookingCollection = db.collection('bookings');

    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }
}

startServer();

// Routes
app.get('/', (req, res) => res.redirect('/home'));

// Home page - show all movies
app.get('/home', async (req, res) => {
  try {
    const movie = await bookingCollection.find().toArray();
    res.render('home', { movie });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// Add movie page
app.get('/add-movie', (req, res) => res.render('add-movie'));

// Add movie POST
app.post('/add-movie', upload.single('picture'), async (req, res) => {
  try {
    const { title, description, seats, price } = req.body;
    const picture = req.file ? req.file.filename : null;

    const seatCount = parseInt(seats);
    const ticketPrice = parseFloat(price);

    const totalSeat = [];
    for (let i = 1; i <= seatCount; i++) {
      totalSeat.push({ seatNo: `S${i}`, booked: false });
    }

    await bookingCollection.insertOne({
      title,
      description,
      picture,
      price: ticketPrice,
      seats: totalSeat
    });

    res.redirect('/add-movie');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// Book movie page
app.get('/book/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const movie = await bookingCollection.findOne({ _id: new ObjectId(id) });
    if (!movie) return res.send('Movie not found');
    res.render('book', { movie });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// Book movie POST
app.post('/book/:id', async (req, res) => {
  try {
    const id = req.params.id;
    let selectedSeats = req.body.selectedSeats || [];
    if (!Array.isArray(selectedSeats)) selectedSeats = [selectedSeats];
    if (selectedSeats.length === 0) return res.send('No seats selected');

    await bookingCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { "seats.$[seat].booked": true } },
      { arrayFilters: [{ "seat.seatNo": { $in: selectedSeats } }] }
    );

    res.redirect('/booking-history');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// Booking history page
app.get('/booking-history', async (req, res) => {
  try {
    const bookings = await bookingCollection.find({ "seats.booked": true }).toArray();

    const formattedBookings = bookings.map(movie => ({
      _id: movie._id,
      title: movie.title,
      picture: movie.picture,
      price: movie.price,
      seats: movie.seats.filter(s => s.booked).map(s => s.seatNo)
    }));

    res.render('booking-history', { bookings: formattedBookings });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});


app.listen(port,()=>{
  console.log(`server is running at http://localhost:${port}`);
});