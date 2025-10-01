const express=require('express');
const app=express();
const {MongoClient,ObjectId}=require('mongodb');
const multer=require('multer');
const path=require('path');
const port=3001;

app.set('view engine','ejs');
app.set('views','views');

app.use(express.urlencoded({extended:false}));
app.use("/uploads",express.static('uploads'));

const client=new MongoClient('mongodb://127.0.0.1:27017');
let bookingCollection;

async function run() {
  await client.connect();
  console.log('Mongo is connected');
  const db=client.db('MovieDataBase');
  bookingCollection=db.collection('bookings');
}
run();
const storage=multer.diskStorage({
  destination:(req,file,cb)=>cb(null,'uploads'),
  filename:(req,file,cb)=>cb(null,Date.now()+path.extname(file.originalname))
});
const upload=multer({
  storage:storage,
  limits:{
    fileSize:1024*1024*10
  }
});

app.get('/',(req,res)=>{
  res.redirect('/home');
});
app.get('/home',async(req,res)=>{
  const movie=await bookingCollection.find().toArray();
  res.render('home',{movie:movie});
});
app.get('/add-movie',(req,res)=>{
  res.render('add-movie');
});
app.post('/add-movie', upload.single('picture'), async (req, res) => {
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
});
app.get('/book/:id', async (req, res) => {
  const id = req.params.id;
  const movie = await bookingCollection.findOne({ _id: new ObjectId(id) });
  if (!movie) return res.send('Movie not found');
  res.render('book', { movie: movie });
});

app.post('/book/:id', async (req, res) => {
  const id = req.params.id;
  let selectedSeats = req.body.selectedSeats;
  if (!Array.isArray(selectedSeats)) selectedSeats = [selectedSeats];
  await bookingCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { "seats.$[seat].booked": true } },
    { arrayFilters: [{ "seat.seatNo": { $in: selectedSeats } }] }
  );
  res.redirect('/booking-history');
});
app.get('/booking-history', async (req, res) => {
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

app.listen(port,()=>{
  console.log(`server is running at http://localhost:${port}`);
});