const jwt = require('jsonwebtoken');
const { User } = require('../config/db');

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

const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.user?.email;
    const user = await User.findOne({ email: email });
    if (!user || user.role !== 'admin') {
      return res.status(403).send({ message: 'Forbidden: Admins only' });
    }
    next();
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error' });
  }
};

module.exports = { verifyToken, verifyAdmin };
