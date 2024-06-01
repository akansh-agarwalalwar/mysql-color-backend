const express = require("express");
const cors = require("cors");
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const mobileAuth = require('./router/router');
const app = express();
app.use(bodyParser.json());
const dotenv = require("dotenv");
dotenv.config();  

app.use(express.json());
app.use(bodyParser.json());
app.use(cors({
  origin: "*",
  methods: ['POST', 'GET'],
  optionsSuccessStatus: 200
}));

const PORT = process.env.PORT || 3001;

const con = mysql.createPool({
  user: 'root',
  password: 'Akansh@2003',
  host: 'localhost',
  database: 'register'
});

// Ensure table exists
async function ensureTableExists() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS register (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        mobileNumber VARCHAR(15) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        confirmPassword VARCHAR(255) NOT NULL,
        referenceCode VARCHAR(255)
      );
    `;
    await con.execute(createTableQuery);
    console.log("Table 'register' ensured in the database.");
  } catch (err) {
    console.error("Error ensuring the table:", err);
  }
}

// Call the function to ensure the table exists
ensureTableExists();

app.use('/api/otp', mobileAuth);

app.post("/register", async (req, res) => {
  const { username, mobileNumber, password, confirmPassword, referenceCode } = req.body;

  if (!username || !mobileNumber || !password || !confirmPassword) {
    return res.status(400).send({ message: "All fields are required" });
  }
  try {
    const [rows] = await con.execute(
      "INSERT INTO register (username, mobileNumber, password, confirmPassword, referenceCode) VALUES (?, ?, ?, ?, ?)",
      [username, mobileNumber, password, confirmPassword, referenceCode]
    );

    res.status(200).send({ message: "Registration Successful", result: rows });
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).send({ message: "Internal Server Error", error: err });
  }
});

app.post("/login", async (req, res) => {
  const { mobileNumber, password } = req.body;

  if (!mobileNumber || !password) {
    return res.status(400).send({ message: "Mobile number and password are required" });
  }

  try {
    const [rows] = await con.execute(
      "SELECT * FROM register WHERE mobileNumber = ? AND password = ?",
      [mobileNumber, password]
    );

    if (rows.length > 0) {
      res.status(200).send(rows);
    } else {
      res.status(401).send({ message: "Invalid credentials" });
    }
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).send({ message: "Internal Server Error", error: err });
  }
});

app.post("/forgot-password", async (req, res) => {
  const { mobileNumber, newPassword } = req.body;

  if (!mobileNumber || !newPassword) {
    return res.status(400).send({ message: "Mobile number and new password are required" });
  }

  try {
    const [result] = await con.execute(
      "UPDATE register SET password = ? WHERE mobileNumber = ?",
      [newPassword, mobileNumber]
    );

    if (result.affectedRows > 0) {
      res.status(200).send({ message: "Password updated successfully" });
    } else {
      res.status(404).send({ message: "User not found" });
    }
  } catch (err) {
    console.error("Error updating password:", err);
    res.status(500).send({ message: "Internal Server Error", error: err });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
