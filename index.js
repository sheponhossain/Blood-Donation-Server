const express = require('express');
const mongoose = require('mongoose'); // একবারই যথেষ্ট
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// --- মিডলওয়্যার ---
app.use(cors());
app.use(express.json());

// --- ১. ডেটাবেস কানেকশন (ডায়নামিক ও সঠিক পদ্ধতি) ---
// আপনার দেওয়া URI টি এখানে ব্যবহার করা হয়েছে
const uri = `mongodb+srv://sheponsu_db_user:${process.env.DB_PASS}@cluster0.gqdrlzl.mongodb.net/bloodDonationDB?retryWrites=true&w=majority&appName=Cluster0`;

mongoose
  .connect(uri)
  .then(() => console.log('❤️ Blood Donation DB Connected Successfully!'))
  .catch((err) => console.log('❌ DB Connection Error:', err));

// --- ২. মডেল (Schemas) ---
const User = mongoose.model(
  'User',
  new mongoose.Schema({
    name: String,
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    bloodGroup: String,
    district: String,
    upazila: String,
    role: { type: String, default: 'donor' },
    status: { type: String, default: 'active' },
  })
);

const DonationRequest = mongoose.model(
  'DonationRequest',
  new mongoose.Schema({
    requesterName: String,
    recipientName: String,
    hospitalName: String,
    address: String,
    bloodGroup: String,
    date: String,
    time: String,
    message: String,
    status: { type: String, default: 'pending' },
  })
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

// টেস্ট রুট
app.get('/', (req, res) => {
  res.send('Blood Donation Server is Running!');
});

// রেজিস্ট্রেশন রুট
app.post('/register', async (req, res) => {
  try {
    const { name, email, password, bloodGroup, district, upazila } = req.body;

    // ইমেইল চেক
    const query = { email: email };
    const existingUser = await User.findOne(query);
    if (existingUser) {
      return res.status(400).send({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      bloodGroup,
      district,
      upazila,
    });
    await newUser.save();
    res.status(201).send({ message: 'Registration Successful' });
  } catch (error) {
    res
      .status(500)
      .send({ message: 'Error registering user', error: error.message });
  }
});

// লগইন রুট
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

// ব্লাড রিকোয়েস্ট তৈরি করা
app.post('/create-request', verifyToken, async (req, res) => {
  try {
    const request = new DonationRequest(req.body);
    await request.save();
    res.send({ message: 'Request Created Successfully' });
  } catch (error) {
    res.status(500).send({ message: 'Failed to create request' });
  }
});

// সকল ব্লাড রিকোয়েস্ট দেখা
app.get('/requests', async (req, res) => {
  const requests = await DonationRequest.find().sort({ date: -1 });
  res.send(requests);
});

// স্ট্যাটাস আপডেট
app.patch('/request-status/:id', verifyToken, async (req, res) => {
  const { status } = req.body;
  await DonationRequest.findByIdAndUpdate(req.params.id, { status });
  res.send({ message: 'Status Updated' });
});

// --- ৫. সার্ভার স্টার্ট ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server flying on port ${PORT}`));
