const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/inbox-hub';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

let db;

app.use(cors());
app.use(express.json());

// Connect to MongoDB
async function connectDB() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db('inbox-hub');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
  }
}

// Make db accessible to routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// ========== ROUTES ==========

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: db ? 'connected' : 'disconnected',
    message: 'Server is running!'
  });
});

// ========== AUTHENTICATION ROUTES ==========

// Register User
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ 
        success: false,
        message: 'Email, password, and name are required' 
      });
    }

    if (!db) {
      return res.status(500).json({ 
        success: false,
        message: 'Database not connected' 
      });
    }

    const users = db.collection('users');
    
    // Check if user already exists
    const existing = await users.findOne({ email });
    if (existing) {
      return res.status(409).json({ 
        success: false,
        message: 'User already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const result = await users.insertOne({
      email,
      password: hashedPassword,
      name,
      createdAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      userId: result.insertedId,
      user: { email, name }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required' 
      });
    }

    if (!db) {
      return res.status(500).json({ 
        success: false,
        message: 'Database not connected' 
      });
    }

    const users = db.collection('users');
    
    // Find user
    const user = await users.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Compare passwords
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      userId: user._id,
      user: { email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// Get current user (protected route)
app.get('/api/auth/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No token provided' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!db) {
      return res.status(500).json({ 
        success: false,
        message: 'Database not connected' 
      });
    }

    const users = db.collection('users');
    const user = await users.findOne({ _id: decoded.userId });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: { _id: user._id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(401).json({ 
      success: false,
      message: 'Invalid token' 
    });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ 
        success: false,
        message: 'Database not connected' 
      });
    }

    const users = db.collection('users');
    const allUsers = await users.find({}).toArray();

    res.json({
      success: true,
      count: allUsers.length,
      users: allUsers.map(u => ({ 
        _id: u._id,
        email: u.email, 
        name: u.name,
        createdAt: u.createdAt 
      }))
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found' 
  });
});

// Start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`✓ Health check: GET http://localhost:${PORT}/api/health`);
    console.log(`✓ Register: POST http://localhost:${PORT}/api/auth/register`);
    console.log(`✓ Login: POST http://localhost:${PORT}/api/auth/login`);
    console.log(`✓ Get me: GET http://localhost:${PORT}/api/auth/me`);
    console.log(`✓ Get users: GET http://localhost:${PORT}/api/users\n`);
  });
});

module.exports = app;