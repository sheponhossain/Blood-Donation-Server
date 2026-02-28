const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { User, DonationRequest, Payment, Blog } = require('../config/db');

// JWT & Auth
exports.createJWT = async (req, res) => {
  try {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: '1h',
    });
    res.send({ token });
  } catch (error) {
    res.status(500).send({ message: 'Error creating token' });
  }
};

exports.register = async (req, res) => {
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
    res.status(500).send({ message: 'Error registering user' });
  }
};

exports.login = async (req, res) => {
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
};

// Donation Requests
exports.createDonation = async (req, res) => {
  try {
    const result = await new DonationRequest(req.body).save();
    res.send({ insertedId: result._id, message: 'Request Created' });
  } catch (error) {
    res.status(500).send({ message: 'Failed to save' });
  }
};

exports.getAllDonations = async (req, res) => {
  const result = await DonationRequest.find().sort({ createdAt: -1 });
  res.send(result);
};

exports.getMyDonations = async (req, res) => {
  const result = await DonationRequest.find({
    requesterEmail: req.params.email,
  }).sort({ createdAt: -1 });
  res.send(result);
};

exports.getSingleDonation = async (req, res) => {
  const result = await DonationRequest.findById(req.params.id);
  res.send(result);
};

exports.deleteDonation = async (req, res) => {
  const result = await DonationRequest.findByIdAndDelete(req.params.id);
  res.send({ deletedCount: result ? 1 : 0 });
};

exports.updateDonation = async (req, res) => {
  const result = await DonationRequest.updateOne(
    { _id: new mongoose.Types.ObjectId(req.params.id) },
    { $set: req.body }
  );
  res.send(result);
};

exports.updateDonationStatus = async (req, res) => {
  const { status, donorName, donorEmail } = req.body;
  const result = await DonationRequest.findByIdAndUpdate(
    req.params.id,
    { $set: { status, donorName, donorEmail } },
    { new: true }
  );
  res.send({ modifiedCount: result ? 1 : 0 });
};

exports.getPendingDonations = async (req, res) => {
  const result = await DonationRequest.find({
    status: { $regex: /^pending$/i },
  }).sort({ createdAt: -1 });
  res.send(result);
};

// Users
exports.getUser = async (req, res) => {
  const user = await User.findOne({ email: req.params.email });
  res.send(user);
};

exports.getAllUsers = async (req, res) => {
  const result = await User.find().sort({ createdAt: -1 });
  res.send(result);
};

exports.updateUser = async (req, res) => {
  const result = await User.updateOne(
    { email: req.params.email },
    { $set: req.body }
  );
  res.send(result);
};

exports.adminUpdateUser = async (req, res) => {
  const result = await User.updateOne(
    { _id: req.params.id },
    { $set: req.body }
  );
  res.send(result);
};

// Admin Stats
exports.getAdminStats = async (req, res) => {
  const totalDonors = await User.countDocuments({ role: 'donor' });
  const totalRequests = await DonationRequest.countDocuments();
  res.send({ totalDonors, totalRequests, totalFunding: 52490 });
};

// Stripe & Payments
exports.createPaymentIntent = async (req, res) => {
  const amount = parseInt(req.body.price * 100);
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    payment_method_types: ['card'],
  });
  res.send({ clientSecret: paymentIntent.client_secret });
};

exports.savePayment = async (req, res) => {
  const result = await new Payment(req.body).save();
  res.send({ insertedId: result._id });
};

exports.getPayments = async (req, res) => {
  const result = await Payment.find().sort({ date: -1 });
  res.send(result);
};

// Search
exports.searchRequests = async (req, res) => {
  const { bloodGroup, division, district } = req.query;
  let query = { status: { $regex: /^pending$/i } };
  if (bloodGroup) query.bloodGroup = bloodGroup;
  if (division) query.division = { $regex: new RegExp(division, 'i') };
  if (district) query.district = { $regex: new RegExp(district, 'i') };
  const result = await DonationRequest.find(query).sort({ createdAt: -1 });
  res.send(result);
};

// Blogs
exports.createBlog = async (req, res) => {
  const result = await new Blog(req.body).save();
  res.send({ insertedId: result._id });
};

exports.getBlogs = async (req, res) => {
  const result = await Blog.find().sort({ createdAt: -1 });
  res.send(result);
};

exports.getPublishedBlogs = async (req, res) => {
  const result = await Blog.find({ status: 'published' }).sort({
    createdAt: -1,
  });
  res.send(result);
};

exports.getBlogDetails = async (req, res) => {
  const result = await Blog.findById(req.params.id);
  res.send(result);
};

exports.updateBlog = async (req, res) => {
  const result = await Blog.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true }
  );
  res.send({ modifiedCount: result ? 1 : 0 });
};

exports.deleteBlog = async (req, res) => {
  const result = await Blog.findByIdAndDelete(req.params.id);
  res.send({ deletedCount: result ? 1 : 0 });
};
