const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = `mongodb+srv://sheponsu_db_user:${process.env.DB_PASS}@cluster0.gqdrlzl.mongodb.net/bloodDonationDB?retryWrites=true&w=majority&appName=Cluster0`;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('❤️ Blood Donation DB Connected Successfully!');
  } catch (err) {
    console.error('❌ DB Connection Error:', err.message);
  }
};

// Models
const User =
  mongoose.models.User ||
  mongoose.model(
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

const DonationRequest =
  mongoose.models.DonationRequest ||
  mongoose.model(
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

const Payment =
  mongoose.models.Payment ||
  mongoose.model(
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

const Blog =
  mongoose.models.Blog ||
  mongoose.model(
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
      { timestamps: true, collection: 'blogs' }
    )
  );

module.exports = { connectDB, User, DonationRequest, Payment, Blog };
