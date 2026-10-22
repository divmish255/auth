import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import twilio from 'twilio';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(morgan('dev'));

// Static files (HTML, CSS, JS frontend) serve karne ke liye
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// CONFIGURATIONS
// ==========================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/auth_system';
const JWT_SECRET = process.env.JWT_SECRET || 'my_super_secret_jwt_key_123';

const accountSid = process.env.TWILIO_ACCOUNT_SID || 'YOUR_TWILIO_ACCOUNT_SID';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'YOUR_TWILIO_AUTH_TOKEN';
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || 'YOUR_TWILIO_PHONE_NUMBER';

const client = (accountSid !== 'YOUR_TWILIO_ACCOUNT_SID') ? twilio(accountSid, authToken) : null;

// ==========================================
// DATABASE CONNECTION
// ==========================================
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.log('DB Connection Error:', err));

// ==========================================
// USER SCHEMA & MODEL
// ==========================================
const userSchema = new mongoose.Schema({
  email: { type: String, sparse: true, unique: true },
  phone: { type: String, sparse: true, unique: true },
  password: { type: String, required: true },
  otp: { type: String },
  otpExpiry: { type: Date },
  isVerified: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

// ==========================================
// API ROUTES
// ==========================================

// 1. REGISTER ROUTE
app.post('/api/register', async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ error: 'Please provide either an email or phone number.' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Please provide a password.' });
    }

    const identifier = email || phone;
    const query = email ? { email } : { phone };

    let existingUser = await User.findOne(query);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email/phone.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const newUser = new User({
      email: email || undefined,
      phone: phone || undefined,
      password: hashedPassword,
      otp,
      otpExpiry
    });

    await newUser.save();

    if (phone && client) {
      try {
        await client.messages.create({
          body: `Aapka verification OTP code hai: ${otp}`,
          from: twilioPhoneNumber,
          to: phone
        });
        console.log(`SMS sent to ${phone}`);
      } catch (smsErr) {
        console.log('Twilio SMS error:', smsErr.message);
      }
    }

    console.log(`\n--- REGISTRATION OTP ---`);
    console.log(`Identifier: ${identifier}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`------------------------\n`);

    res.status(201).json({
      message: 'Registration successful! Check console/SMS for OTP code.',
      identifier,
      otpDemo: otp // Demo UI par dikhane ke liye
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. VERIFY OTP ROUTE
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, phone, otp } = req.body;
    const query = email ? { email } : { phone };

    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.isVerified) {
      return res.status(400).json({ message: 'User is already verified.' });
    }

    if (user.otp !== otp || user.otpExpiry < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({ message: 'Account verified successfully! You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. LOGIN ROUTE
app.post('/api/login', async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    const query = email ? { email } : { phone };

    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Please verify your account using OTP first.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid password.' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login successful!', token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. PROTECTED PROFILE ROUTE
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied. Token missing.' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = decoded;
    next();
  });
};

app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json({ message: 'Protected profile data accessed successfully', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Front-end fallback route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
