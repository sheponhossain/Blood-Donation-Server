const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

app.use(
  cors({
    origin: ['https://blood-donation-11.web.app', 'http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json());

const uri = `mongodb+srv://sheponsu_db_user:${process.env.DB_PASS}@cluster0.gqdrlzl.mongodb.net/bloodDonationDB?retryWrites=true&w=majority&appName=Cluster0`;

mongoose
  .connect(uri)
  .then(() => console.log('❤️ Blood Donation DB Connected Successfully!'))
  .catch((err) => console.log('❌ DB Connection Error:', err));

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

const DonationRequest = mongoose.model(
  'DonationRequest',
  new mongoose.Schema(
    {
      requesterName: String,
      requesterEmail: String,
      recipientName: String,
      hospitalName: String,
      fullAddress: String,
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

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' });
    }
    req.user = decoded;
    next();
  });
};

app.post('/jwt', async (req, res) => {
  try {
    const user = req.body;
    if (!process.env.ACCESS_TOKEN_SECRET) {
      console.log('❌ ERROR: ACCESS_TOKEN_SECRET is missing in .env file!');
      return res.status(500).send({ message: 'Secret key missing' });
    }

    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: '1h',
    });
    res.send({ token });
  } catch (error) {
    console.error('JWT Error:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

app.get('/', (req, res) => {
  res.send('Blood Donation Server is Running!');
});

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
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user && (await bcrypt.compare(password, user.password))) {
    const token = jwt.sign(
      { email: user.email.toLowerCase(), role: user.role },
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

app.post('/donation-requests', async (req, res) => {
  try {
    const requestData = req.body;
    const newRequest = new DonationRequest(requestData);
    const result = await newRequest.save();
    res.send({
      insertedId: result._id,
      message: 'Request Created Successfully',
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send({ message: 'Failed to save donation request' });
  }
});

app.get('/donation-requests', async (req, res) => {
  try {
    const result = await DonationRequest.find().sort({ createdAt: -1 });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching all requests' });
  }
});

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

app.get('/user/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    res.send(user);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

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

app.get('/donation-request/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await DonationRequest.findById(id);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Request not found' });
  }
});

app.patch('/donation-request/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const filter = { _id: new mongoose.Types.ObjectId(id) };
    const updatedDoc = {
      $set: req.body,
    };
    const result = await DonationRequest.updateOne(filter, updatedDoc);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Update failed' });
  }
});

app.get('/admin-stats', async (req, res) => {
  try {
    const totalDonors = await User.countDocuments({ role: 'donor' });
    const totalRequests = await DonationRequest.countDocuments();

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

const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.user?.email;
    console.log('Admin verification for:', email);

    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(403).send({ message: 'User not found in database' });
    }

    if (user.role !== 'admin') {
      console.log(`Access denied for: ${email}, Role: ${user.role}`);
      return res.status(403).send({ message: 'Forbidden: Admins only' });
    }

    next();
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error' });
  }
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

app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await User.find().sort({ createdAt: -1 });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch users' });
  }
});

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

app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalDonors = await User.countDocuments({ role: 'donor' });
    const totalRequests = await DonationRequest.countDocuments();
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

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { price } = req.body;
    if (!price || price <= 0)
      return res.status(400).send({ message: 'Invalid price' });

    const amount = parseInt(price * 100);

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

app.get('/payments', async (req, res) => {
  try {
    const result = await Payment.find().sort({ date: -1 });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching payments' });
  }
});

app.get('/search-requests', async (req, res) => {
  try {
    const { bloodGroup, division, district } = req.query;
    console.log('Search parameters received:', req.query);

    let query = {};
    query.status = { $regex: /^pending$/i };

    if (bloodGroup) {
      query.bloodGroup = bloodGroup;
    }

    if (division) {
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

app.post('/blogs', async (req, res) => {
  try {
    const newBlog = new Blog(req.body);
    const result = await newBlog.save();
    res.send({ insertedId: result._id, message: 'Published Successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Failed to publish blog' });
  }
});

app.post('/blogs', async (req, res) => {
  try {
    const blogData = req.body;
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

app.get('/blogs/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await Blog.findById(id);
    if (result) {
      res.send(result);
    } else {
      res.status(404).send({ message: 'Blog not found' });
    }
  } catch (error) {
    res
      .status(500)
      .send({ message: 'Error fetching blog details', error: error.message });
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

app.patch('/donation-request/status/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { status, donorName, donorEmail } = req.body;
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server flying on port ${PORT}`));
