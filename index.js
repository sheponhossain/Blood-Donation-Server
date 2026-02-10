const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// --- মিডলওয়্যার ---
app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json());

// --- ১. ডেটাবেস কানেকশন (Mongoose) ---
const uri = `mongodb+srv://sheponsu_db_user:${process.env.DB_PASS}@cluster0.gqdrlzl.mongodb.net/bloodDonationDB?retryWrites=true&w=majority&appName=Cluster0`;

mongoose
  .connect(uri)
  .then(() => console.log('❤️ Blood Donation DB Connected Successfully!'))
  .catch((err) => console.log('❌ DB Connection Error:', err));

// --- ২. মডেল (Schemas) ---
const User = mongoose.model(
  'User',
  new mongoose.Schema(
    {
      name: String,
      email: { type: String, unique: true, required: true },
      password: { type: String, required: true },
      bloodGroup: String,
      division: String,
      district: String,
      avatar: String,
      role: { type: String, default: 'donor' },
      status: { type: String, default: 'active' },
    },
    { timestamps: true }
  )
);

// Frontend theke asha shob field ekhane add kora hoyeche
const DonationRequest = mongoose.model(
  'DonationRequest',
  new mongoose.Schema(
    {
      requesterName: String,
      requesterEmail: String,
      recipientName: String,
      hospitalName: String,
      fullAddress: String, // input name onusare
      district: String,
      bloodGroup: String,
      donationDate: String,
      donationTime: String,
      message: String,
      status: { type: String, default: 'pending' },
    },
    { timestamps: true }
  )
);

// --- ৩. মিডলওয়্যার (JWT Auth) ---
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send({ message: 'Unauthorized access' });

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: 'Forbidden access' });
    req.user = decoded;
    next();
  });
};

// --- ৪. রুটস (API Endpoints) ---

app.get('/', (req, res) => {
  res.send('Blood Donation Server is Running!');
});

// Registration & Login (Apnar code thik ache...)
app.post('/register', async (req, res) => {
  try {
    const { name, email, password, bloodGroup, district, division, avatar } =
      req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).send({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      bloodGroup,
      district,
      division,
      avatar,
    });
    await newUser.save();
    res.status(201).send({ message: 'Registration Successful' });
  } catch (error) {
    res
      .status(500)
      .send({ message: 'Error registering user', error: error.message });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && (await bcrypt.compare(password, user.password))) {
    const token = jwt.sign(
      { email: user.email, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );
    res.send({
      token,
      user: { name: user.name, email: user.email, role: user.role },
    });
  } else {
    res.status(401).send({ message: 'Invalid email or password' });
  }
});

// --- ✅ FIX: Donation Request API (Using Mongoose Model) ---
app.post('/donation-requests', async (req, res) => {
  try {
    const requestData = req.body;
    const newRequest = new DonationRequest(requestData);
    const result = await newRequest.save();
    // Frontend-er subidharthe insertedId manually add kora holo jate Swal success ashe
    res.send({
      insertedId: result._id,
      message: 'Request Created Successfully',
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send({ message: 'Failed to save donation request' });
  }
});

// User-er email onusare tar request gulo niye asha
app.get('/my-donation-requests/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const result = await DonationRequest.find({ requesterEmail: email }).sort({
      createdAt: -1,
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Profile Update & Others...
app.get('/user/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    res.send(user);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// --- ৫. সার্ভার স্টার্ট ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server flying on port ${PORT}`));
