const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
      division: String,
      recipientDistrict: String,
      district: String,
      bloodGroup: String,
      donationDate: String,
      donationTime: String,
      message: String,
      status: { type: String, default: 'pending' },
      donorName: { type: String, default: null },
      donorEmail: { type: String, default: null },
    },
    { timestamps: true }
  )
);

// payment
const Payment = mongoose.model(
  'Payment',
  new mongoose.Schema(
    {
      userName: String,
      amount: Number,
      date: { type: Date, default: Date.now },
      method: String,
      transactionId: String,
      status: String,
    },
    { timestamps: true }
  )
);

// ব্লগ মডেল (Schema)
const Blog = mongoose.model(
  'Blog',
  new mongoose.Schema(
    {
      title: String,
      image: String,
      category: String,
      content: String,
      date: String,
      status: { type: String, default: 'draft' },
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

// সব রিকোয়েস্ট অ্যাডমিন/সিস্টেমের জন্য পাওয়ার রুট
app.get('/donation-requests', async (req, res) => {
  try {
    // ডাটাবেস থেকে সব রিকোয়েস্ট লেটেস্ট হিসেবে নিয়ে আসা
    const result = await DonationRequest.find().sort({ createdAt: -1 });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching all requests' });
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

// নিশ্চিত করুন এই রুটটি আপনার server.js এ আছে
// server/index.js
app.delete('/donation-request/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const result = await DonationRequest.findByIdAndDelete(id);

    if (result) {
      res.send({ deletedCount: 1, message: 'Deleted successfully' });
    } else {
      res.status(404).send({ message: 'Request not found' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).send({ message: 'Server error' });
  }
});

// ১. নির্দিষ্ট রিকোয়েস্টের ডেটা আনা (Get Single Request)
app.get('/donation-request/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await DonationRequest.findById(id); // Mongoose model use korle
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Request not found' });
  }
});

// ২. ডেটা আপডেট করা (Update Request)
app.patch('/donation-request/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const filter = { _id: new mongoose.Types.ObjectId(id) };
    const updatedDoc = {
      $set: req.body, // Frontend theke asha formData set hobe
    };
    const result = await DonationRequest.updateOne(filter, updatedDoc);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Update failed' });
  }
});

// অ্যাডমিন স্ট্যাটাস ডাটা পাওয়ার রুট
app.get('/admin-stats', async (req, res) => {
  try {
    const totalDonors = await User.countDocuments({ role: 'donor' });
    const totalRequests = await DonationRequest.countDocuments();

    // ফান্ডিং আপাতত স্ট্যাটিক বা আপনার যদি অন্য কালেকশন থাকে সেখান থেকে আনতে পারেন
    const totalFunding = 52490;

    res.send({
      totalDonors,
      totalRequests,
      totalFunding,
    });
  } catch (error) {
    res.status(500).send({ message: 'Error fetching stats' });
  }
});

// সব ইউজারদের নিয়ে আসা (অ্যাডমিনের জন্য)
app.get('/users', verifyToken, async (req, res) => {
  try {
    const result = await User.find().sort({ createdAt: -1 });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch users' });
  }
});

// ইউজারের স্ট্যাটাস বা রোল আপডেট করা
app.patch('/users/update/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body; // এতে থাকবে { status: 'blocked' } অথবা { role: 'admin' }
    const result = await User.updateOne({ _id: id }, { $set: updateData });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Update failed' });
  }
});

// --- নতুন মিডলওয়্যার: Admin চেক করার জন্য ---
const verifyAdmin = async (req, res, next) => {
  const email = req.user.email;
  const user = await User.findOne({ email });
  if (user?.role !== 'admin') {
    return res.status(403).send({ message: 'Forbidden access! Admins only.' });
  }
  next();
};

app.patch('/user-update/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const updateData = req.body;
    const result = await User.updateOne({ email: email }, { $set: updateData });

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: 'User not found' });
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Update failed', error: error.message });
  }
});

// --- আপডেট করা রুটসমূহ (verifyAdmin যোগ করা হয়েছে) ---

// সব ইউজারদের নিয়ে আসা (শুধুমাত্র অ্যাডমিনের জন্য)
app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await User.find().sort({ createdAt: -1 });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch users' });
  }
});

// ইউজারের স্ট্যাটাস বা রোল আপডেট করা (শুধুমাত্র অ্যাডমিনের জন্য)
app.patch('/users/update/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;
    const result = await User.updateOne({ _id: id }, { $set: updateData });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Update failed' });
  }
});

// অ্যাডমিন স্ট্যাটাস ডাটা (verifyAdmin যোগ করা নিরাপদ)
app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalDonors = await User.countDocuments({ role: 'donor' });
    const totalRequests = await DonationRequest.countDocuments();
    const totalFunding = 52490; // আপাতত স্ট্যাটিক

    res.send({
      totalDonors,
      totalRequests,
      totalFunding,
    });
  } catch (error) {
    res.status(500).send({ message: 'Error fetching stats' });
  }
});

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { price } = req.body;
    if (!price || price <= 0)
      return res.status(400).send({ message: 'Invalid price' });

    const amount = parseInt(price * 100); // সেন্টে কনভার্ট

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card'],
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Stripe Error:', error);
    res.status(500).send({ message: error.message });
  }
});

// পেমেন্ট ডাটা সেভ
app.post('/payments', async (req, res) => {
  try {
    const paymentData = req.body;
    const newPayment = new Payment(paymentData);
    const result = await newPayment.save();
    res.send({ insertedId: result._id, message: 'Payment Saved' });
  } catch (error) {
    res.status(500).send({ message: 'Failed to save payment' });
  }
});

// সব পেমেন্ট হিস্ট্রি দেখা
app.get('/payments', async (req, res) => {
  try {
    const result = await Payment.find().sort({ date: -1 });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching payments' });
  }
});

// --- Search Donors API ---
// আপনার ব্যাকেন্ডে (server index.js) এটি যোগ করুন
app.get('/search-requests', async (req, res) => {
  try {
    const { bloodGroup, division, district } = req.query;

    // ব্যাকেন্ডে প্রিন্ট করে দেখুন কি আসছে
    console.log('Search parameters received:', req.query);

    let query = {};

    // যদি আপনি চান শুধু পেন্ডিং রিকোয়েস্ট দেখাবেন
    query.status = { $regex: /^pending$/i };

    if (bloodGroup) {
      query.bloodGroup = bloodGroup;
    }

    if (division) {
      // এটি 'dhaka' বা 'Dhaka' যাই হোক না কেন খুঁজে বের করবে
      query.division = { $regex: new RegExp(division, 'i') };
    }

    if (district) {
      query.district = { $regex: new RegExp(district, 'i') };
    }

    console.log('Final Mongo Query:', query);

    const result = await DonationRequest.find(query).sort({ createdAt: -1 });
    console.log('Results found:', result.length);

    res.send(result);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

// পাবলিক পেজের জন্য শুধুমাত্র পেন্ডিং রিকোয়েস্টগুলো আনা
app.get('/donation-requests-pending', async (req, res) => {
  try {
    const result = await DonationRequest.find({ status: 'pending' }).sort({
      createdAt: -1,
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching requests' });
  }
});

// backend/index.js (উদাহরণ)

app.post('/blogs', async (req, res) => {
  try {
    const newBlog = new Blog(req.body); // আপনি উপরে 'Blog' মডেল তৈরি করেছেন, সেটি ব্যবহার হচ্ছে
    const result = await newBlog.save();
    res.send({ insertedId: result._id, message: 'Published Successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Failed to publish blog' });
  }
});

// ৩. ব্লগ ডাটা রিড করার API (UI তে দেখানোর জন্য)
// --- ব্লগ সম্পর্কিত রুটস ---

// ১. নতুন ব্লগ পোস্ট করা (অ্যাডমিনের জন্য)
app.post('/blogs', async (req, res) => {
  try {
    const blogData = req.body;
    // যদি ফ্রন্টএন্ড থেকে স্ট্যাটাস না আসে, তবে নিশ্চিতভাবে 'draft' সেট হবে
    if (!blogData.status) blogData.status = 'draft';

    const newBlog = new Blog(blogData);
    const result = await newBlog.save();
    res.send({ insertedId: result._id, message: 'Draft Saved Successfully' });
  } catch (error) {
    res.status(500).send({ message: 'Failed to create blog' });
  }
});

app.get('/blogs', async (req, res) => {
  try {
    const result = await Blog.find().sort({ createdAt: -1 });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching blogs' });
  }
});

// ৩. ব্লগ ডিলিট করা
app.delete('/blogs/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await Blog.findByIdAndDelete(id);
    if (result) {
      res.send({ deletedCount: 1 });
    } else {
      res.status(404).send({ message: 'Blog not found' });
    }
  } catch (error) {
    res.status(500).send({ message: 'Delete failed' });
  }
});

app.patch('/blogs/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;

    const result = await Blog.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (result) {
      // modifiedCount ১ পাঠানো হচ্ছে যাতে ফ্রন্টএন্ডের Swal success পায়
      res.send({
        modifiedCount: 1,
        matchedCount: 1,
        message: 'Updated successfully',
      });
    } else {
      res.status(404).send({ message: 'Blog not found' });
    }
  } catch (error) {
    res.status(500).send({ message: 'Update failed' });
  }
});

// পাবলিক ইউজারদের জন্য শুধু পাবলিশড ব্লগ
app.get('/blogs-published', async (req, res) => {
  try {
    const result = await Blog.find({ status: 'published' }).sort({
      createdAt: -1,
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching blogs' });
  }
});

// ডোনেশন রিকোয়েস্ট কনফার্ম করার রুট
app.patch('/donation-request/status/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { status, donorName, donorEmail } = req.body;

    // ডাটা ঠিকমতো আসছে কি না ব্যাকএন্ড টার্মিনালে চেক করুন
    console.log('Received Data:', { status, donorName, donorEmail });

    const result = await DonationRequest.findByIdAndUpdate(
      id,
      {
        $set: {
          status: status,
          donorName: donorName,
          donorEmail: donorEmail,
        },
      },
      { new: true }
    );

    if (result) {
      res.send({ modifiedCount: 1 });
    } else {
      res.status(404).send({ message: 'Not found' });
    }
  } catch (error) {
    res.status(500).send({ message: 'Server error' });
  }
});

// --- ৫. সার্ভার স্টার্ট ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server flying on port ${PORT}`));
