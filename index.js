const express = require("express");
const cors = require("cors");
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const otpGenerator = require('otp-generator');
const cookieParser = require('cookie-parser');

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
const dotenv = require("dotenv");
dotenv.config();

app.use(express.json());
const corsOptions = {
  origin: 'http://localhost:3000', // specify the frontend URL
  methods: ['POST', 'GET'],
  credentials: true, // allow credentials
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

const PORT = process.env.PORT || 4000;

const con = mysql.createPool({
  user: 'root',
  password: 'Akansh@2003',
  host: 'localhost',
  database: 'PERFECTORSE'
});

async function ensureTableExists() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS register (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        mobileNumber VARCHAR(15) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        confirmPassword VARCHAR(255) NOT NULL,
        referenceCode VARCHAR(10),
        IDOfUser VARCHAR(10),
        userReferenceCode VARCHAR(10),
        balance DECIMAL(10, 2) DEFAULT 0
      );
    `;
    await con.execute(createTableQuery);
    console.log("Table 'register' ensured in the database.");
  } catch (err) {
    console.error("Error ensuring the table:", err);
  }
}

ensureTableExists();

const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function generateRandomUserId() {
  // Generate a random 10-digit number
  const userId = Math.floor(1000000000 + Math.random() * 9000000000);
  return userId;
}

const otpStore = {}; // In-memory store for OTPs
app.post("/register", async (req, res) => {
  const { username, mobileNumber, email, password, confirmPassword, referenceCode } = req.body;

  if (!username || !mobileNumber || !email || !password || !confirmPassword) {
    return res.status(400).send({ message: "All fields are required" });
  }

  try {
    // Generate a random user ID
    const userId = await generateRandomUserId();
    // Check if the user already exists with the provided email or mobile number
    const [existingUsersWithEmail] = await con.execute(
      "SELECT * FROM register WHERE email = ?",
      [email]
    );

    const [existingUsersWithMobile] = await con.execute(
      "SELECT * FROM register WHERE mobileNumber = ?",
      [mobileNumber]
    );

    if (existingUsersWithEmail.length > 0) {
      return res.status(400).send({ message: "Email already exists" });
    }

    if (existingUsersWithMobile.length > 0) {
      return res.status(400).send({ message: "Mobile number already exists" });
    }

    // Check if the reference code exists in the table
    const [rows] = await con.execute(
      "SELECT * FROM register WHERE userReferenceCode = ?",
      [referenceCode]
    );

    let balance = 20;
    if (rows.length > 0) {
      balance = 30;
    }

    // If user doesn't exist, proceed with registration
    const userReferenceCode = otpGenerator.generate(7, { upperCaseAlphabets: true, specialChars: false });
    const [result] = await con.execute(
      "INSERT INTO register (username, mobileNumber, email, password, confirmPassword, referenceCode, IDOfUser, userReferenceCode, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [username, mobileNumber, email, password, confirmPassword, referenceCode, userId, userReferenceCode, balance]
    );

    const insertedUserId = result.insertId;
    res.status(200).send({ message: "Registration Successful", userId: insertedUserId });
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).send({ message: "Internal Server Error", error: err });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send({ message: "Email and password are required" });
  }

  try {
    const [rows] = await con.execute(
      "SELECT IDOfUser, username, balance FROM register WHERE email = ? AND password = ?",
      [email, password]
    );

    if (rows.length === 1) {
      const user = rows[0];
      res.cookie('user', { userId: user.IDOfUser, username: user.username, balance: user.balance }, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: 'Lax' }); // 1 day
      return res.status(200).send({ message: "Login successful", userId: user.IDOfUser, username: user.username, balance: user.balance });
    } else {
      return res.status(401).send({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send({ message: "Internal Server Error", error: error });
  }
});



app.post("/logout", (req, res) => {
  res.clearCookie('user');
  res.status(200).send({ message: "Logout successful" });
});

app.post("/send-email-otp", async (req, res) => {
  const { email } = req.body;
  const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'OTP Verification For Name',
      text: `Your OTP code is ${otp}`
    });

    otpStore[email] = otp; // otpStore should be an in-memory store
    console.log(`OTP sent successfully to ${email}: ${otp}`); // Log the OTP sent
    res.status(200).send({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).send({ message: 'Failed to send OTP' }); 
  }
});

app.post("/verify-email-otp", (req, res) => {
  const { email, otp } = req.body;

  if (otpStore[email] === otp) {
    delete otpStore[email];
    res.status(200).send({ message: 'OTP verified successfully' });
  } else {
    res.status(400).send({ message: 'Invalid OTP' });
  }
});
app.get("/balance", async (req, res) => {
  const userId = req.cookies.user && req.cookies.user.userId;

  if (!userId) {
    return res.status(401).send({ message: "User not authenticated" });
  }

  try {
    const [rows] = await con.execute("SELECT balance FROM register WHERE IDOfUser = ?", [userId]);

    if (rows.length === 1) {
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      return res.status(200).send({ balance: rows[0].balance });
    } else {
      return res.status(404).send({ message: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching balance:", error);
    return res.status(500).send({ message: "Internal Server Error", error: error });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
