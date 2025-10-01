const express = require('express');
const app = express();
const serverless = require('serverless-http');
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');

app.set('view engine', 'ejs');
app.set('views', 'views');
app.use(express.urlencoded({ extended: false }));

// MongoDB
const client = new MongoClient(process.env.MONGODB_URI);
let bookingCollection;

async function connectDB() {
  if (!bookingCollection) {
    await client.connect();
    const db = client.db('MovieDataBase');
    bookingCollection = db.collection('bookings');
  }
}
connectDB();

// Multer file uploads cannot work on Vercel
// You need to use cloud storage like **Cloudinary** for images

// Routes
app.get('/', (req, res) => res.redirect('/home'));
app.get('/home', async (req, res) => {
  await connectDB();
  const movie = await bookingCollection.find().toArray();
  res.render('home', { movie });
});

app.get('/add-movie', (req, res) => res.send("Use API with Cloud storage"));
app.get('/book/:id', async (req, res) => {
  await connectDB();
  const movie = await bookingCollection.findOne({ _id: new ObjectId(req.params.id) });
  res.render('book', { movie });
});

app.post('/book/:id', async (req, res) => {
  await connectDB();
  let selectedSeats = req.body.selectedSeats || [];
  if (!Array.isArray(selectedSeats)) selectedSeats = [selectedSeats];
  await bookingCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { "seats.$[seat].booked": true } },
    { arrayFilters: [{ "seat.seatNo": { $in: selectedSeats } }] }
  );
  res.redirect('/booking-history');
});

app.get('/booking-history', async (req, res) => {
  await connectDB();
  const bookings = await bookingCollection.find({ "seats.booked": true }).toArray();
  const formattedBookings = bookings.map(movie => ({
    _id: movie._id,
    title: movie.title,
    picture: movie.picture,
    price: movie.price,
    seats: movie.seats.filter(s => s.booked).map(s => s.seatNo)
  }));
  res.render('booking-history', { bookings: formattedBookings });
});

// Export handler for Vercel
module.exports.handler = serverless(app);
