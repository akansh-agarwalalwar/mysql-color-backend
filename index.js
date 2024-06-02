const express = require("express");
const cors = require("cors");
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const otpGenerator = require('otp-generator');

const app = express();
app.use(bodyParser.json());
const dotenv = require("dotenv");
dotenv.config();

app.use(express.json());
app.use(cors({
  origin: "*",
  methods: ['POST', 'GET'],
  optionsSuccessStatus: 200
}));

const PORT = process.env.PORT || 4000;

const con = mysql.createPool({
  user: 'root',
  password: 'Akansh@2003',
  host: 'localhost',
  database: 'register'
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
        referenceCode VARCHAR(255),
        IDOfUser VARCHAR(10) 
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

    // If user doesn't exist, proceed with registration
    // const [rows] = await con.execute(
    //   "INSERT INTO register (username, mobileNumber, email, password, confirmPassword, referenceCode) VALUES (?, ?, ?, ?, ?, ?)",
    //   [username, mobileNumber, email, password, confirmPassword, referenceCode]
    // );
    const [rows] = await con.execute(
      "INSERT INTO register (username, mobileNumber, email, password, confirmPassword, referenceCode, IDOfUser) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [username, mobileNumber, email, password, confirmPassword, referenceCode, userId]
    );
    const insertedUserId = rows.insertId;
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
      "SELECT IDOfUser, username FROM register WHERE email = ? AND password = ?",
      [email, password]
    );

    if (rows.length === 1) {
      const user = rows[0];
      return res.status(200).send({ message: "Login successful", userId: user.IDOfUser, username: user.username });
      
    } else {
      return res.status(401).send({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send({ message: "Internal Server Error", error: error });
  }
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
