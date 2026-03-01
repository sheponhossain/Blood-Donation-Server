const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { connectDB } = require('./config/db');
const { verifyToken, verifyAdmin } = require('./middleware/auth');
const h = require('./controllers/handler');

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      'https://blood-donation-11.web.app',
      'https://blood-donation-11.firebaseapp.com',
      'http://localhost:5173',
    ],
    credentials: true,
  })
);
app.use(express.json());

// Database
connectDB();

// --- Routes ---
app.get('/', (req, res) => res.send('Blood Donation Server is Running!'));
app.post('/jwt', h.createJWT);
app.post('/register', h.register);
app.post('/login', h.login);

// Donation Routes
app.post('/donation-requests', h.createDonation);
app.get('/donation-requests', h.getAllDonations);
app.get('/my-donation-requests/:email', h.getMyDonations);
app.get('/donation-request/:id', h.getSingleDonation);
app.delete('/donation-request/:id', h.deleteDonation);
app.patch('/donation-request/:id', h.updateDonation);
app.patch('/donation-request/status/:id', h.updateDonationStatus);
app.get('/donation-requests-pending', h.getPendingDonations);

// User Routes
app.get('/user/:email', h.getUser);
app.get('/users', verifyToken, verifyAdmin, h.getAllUsers);
app.patch('/user-update/:email', h.updateUser);
app.patch('/users/update/:id', verifyToken, verifyAdmin, h.adminUpdateUser);

// Search & Admin Stats
app.get('/search-requests', h.searchRequests);
app.get('/admin-stats', verifyToken, verifyAdmin, h.getAdminStats);

// Payment Routes
app.post('/create-payment-intent', h.createPaymentIntent);
app.post('/payments', h.savePayment);
app.get('/payments', h.getPayments);

// Blog Routes
app.post('/blogs', h.createBlog);
app.get('/blogs', h.getBlogs);
app.get('/blogs-published', h.getPublishedBlogs);
app.get('/blogs/:id', h.getBlogDetails);
app.patch('/blogs/:id', h.updateBlog);
app.delete('/blogs/:id', h.deleteBlog);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app;
