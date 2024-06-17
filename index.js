const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");
const cookieParser = require("cookie-parser");

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
// app.use((req, res, next) => {
//   console.log('Headers:', req.headers);
//   console.log('Cookies:', req.cookies);
//   next();
// });
const dotenv = require("dotenv");
dotenv.config();

app.use(express.json());
const corsOptions = {
  origin: "https://mysql-react-frontend-color.vercel.app",
  methods: ["POST", "GET"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

const PORT = process.env.PORT || 4000;

const con = mysql.createPool({
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  host: process.env.MYSQL_HOST,
  database: process.env.MYSQL_DB,
  port: 3306,
});

async function ensureTableExists() {
  try {
    // Create the register table
    const createRegisterTableQuery = `
      CREATE TABLE IF NOT EXISTS register (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        mobileNumber VARCHAR(15) NOT NULL UNIQUE,
        useremail VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        confirmPassword VARCHAR(255) NOT NULL,
        referenceCode VARCHAR(10),
        IDOfUser VARCHAR(10),
        userReferenceCode VARCHAR(10),
        balance DECIMAL(10, 2) DEFAULT 0
      );
    `;
    await con.execute(createRegisterTableQuery);
    console.log("Table 'register' ensured in the database.");

    const createUploadImagesTableQuery = `
      CREATE TABLE IF NOT EXISTS uploadimages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId BIGINT,
        amount DECIMAL(10, 2),
        status ENUM('pending', 'approved', 'denied') DEFAULT 'pending'
      );
    `;
    await con.execute(createUploadImagesTableQuery);
    console.log("Table 'uploadimages' ensured in the database.");

    // Create the admin table
    const createAdminTableQuery = `
      CREATE TABLE IF NOT EXISTS admin (
        id INT AUTO_INCREMENT PRIMARY KEY,
        adminemail VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL
      );
    `;
    await con.execute(createAdminTableQuery);
    console.log("Table 'admin' ensured in the database.");

    const createRechargeHistory = `
    CREATE TABLE IF NOT EXISTS rechargehistory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId BIGINT,
    amount DECIMAL(10, 2),
    rechargeDate DATE,
    status ENUM('approved', 'denied')
  );
    `;

    await con.execute(createRechargeHistory);
    console.log("Table 'recharge' ensured in the database");

    const createAllPeriodsTableThirtySecond = `
    CREATE TABLE IF NOT EXISTS allperiodsThirtySecond (
    id INT AUTO_INCREMENT PRIMARY KEY,
    periodNumber VARCHAR(255) NOT NULL,
    periodDate DATE,
    periodTime VARCHAR(255),
    colorWinner VARCHAR(255) NOT NULL,
    numberWinner VARCHAR(255) NOT NULL
    );
    `;

    await con.execute(createAllPeriodsTableThirtySecond);
    console.log("Table 'All Periods Thirty Second' ensured in the database");

    const createAllUserPeriodsTableThirtySecond = `
    CREATE TABLE IF NOT EXISTS alluserperiodsThirtySecond (
    id INT AUTO_INCREMENT PRIMARY KEY,
    IDOfUser BIGINT,
    periodNumber VARCHAR(255) NOT NULL,
    periodDate DATE NOT NULL,
    periodTime VARCHAR(255) NOT NULL,
    betType ENUM('number','color'),
    berforeBetAmount BIGINT NOT NULL,
    betAmount BIGINT NOT NULL,
    afterBetAmount BIGINT NOT NULL,
    status ENUM('win', 'lose')
  ); 
    `;

    await con.execute(createAllUserPeriodsTableThirtySecond);
    console.log("Table 'Thirty Second User Table' ensured in the database");

    const createWithdrawHistory = `
    CREATE TABLE IF NOT EXISTS withdrawhistory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId BIGINT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL ,
    withdrawDate DATE NOT NULL,
    status ENUM('approved', 'denied','pending') DEFAULT 'pending'
  );
    `;
    await con.execute(createWithdrawHistory);
    console.log("Table 'Withdraw History' ensured in the database");

    const bankUserDetails = `
    CREATE TABLE IF NOT EXISTS bankDetails (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId BIGINT NOT NULL,
        accountNumber VARCHAR(255) NOT NULL,
        ifscCode VARCHAR(255) NOT NULL
    );
`;
    await con.execute(bankUserDetails);
    console.log("Table 'Bank Details' ensured in the database");

    // Insert predefined admin credentials
    const predefinedAdmins = [
      { adminemail: "akansh@gmail.com", password: "akansh" },
      { adminemail: "aka@gmail.com", password: "akansh" },
      { adminemail: "akan@gmail.com", password: "akansh" },
    ];
    for (const admin of predefinedAdmins) {
      const [rows] = await con.execute(
        "SELECT * FROM admin WHERE adminemail = ?",
        [admin.adminemail]
      );
      if (rows.length === 0) {
        await con.execute(
          "INSERT INTO admin (adminemail, password) VALUES (?, ?)",
          [admin.adminemail, admin.password]
        );
      }
    }
  } catch (err) {
    console.error("Error ensuring the tables:", err);
  }
}

ensureTableExists();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function generateRandomUserId() {
  // Generate a random 10-digit number
  const userId = Math.floor(1000000000 + Math.random() * 9000000000);
  return userId;
}

const otpStore = {}; // In-memory store for OTPs
app.post("/register", async (req, res) => {
  const {
    username,
    mobileNumber,
    useremail,
    password,
    confirmPassword,
    referenceCode,
  } = req.body;

  if (
    !username ||
    !mobileNumber ||
    !useremail ||
    !password ||
    !confirmPassword
  ) {
    return res.status(400).send({ message: "All fields are required" });
  }

  try {
    // Generate a random user ID
    const userId = await generateRandomUserId();
    // Check if the user already exists with the provided email or mobile number
    const [existingUsersWithEmail] = await con.execute(
      "SELECT * FROM register WHERE useremail = ?",
      [useremail]
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

    if (referenceCode === "CODER") {
      balance = 50;
    }

    // If user doesn't exist, proceed with registration
    const userReferenceCode = otpGenerator.generate(7, {
      upperCaseAlphabets: true,
      specialChars: false,
      lowerCaseAlphabets: true,
    });
    const [result] = await con.execute(
      "INSERT INTO register (username, mobileNumber, useremail, password, confirmPassword, referenceCode, IDOfUser, userReferenceCode, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        username,
        mobileNumber,
        useremail,
        password,
        confirmPassword,
        referenceCode,
        userId,
        userReferenceCode,
        balance,
      ]
    );

    const insertedUserId = result.insertId;
    res
      .status(200)
      .send({ message: "Registration Successful", userId: insertedUserId });
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).send({ message: "Internal Server Error", error: err });
  }
});

app.post("/login", async (req, res) => {
  const { useremail, password } = req.body;

  if (!useremail || !password) {
    return res.status(400).send({ message: "Email and password are required" });
  }

  try {
    // Check if the user is an admin
    const [adminRows] = await con.execute(
      "SELECT * FROM admin WHERE adminemail = ? AND password = ?",
      [useremail, password]
    );

    if (adminRows.length === 1) {
      const admin = adminRows[0];
      res.cookie(
        "admin",
        {
          adminId: admin.id,
          adminemail: admin.adminemail,
        },
        { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: "Lax" }
      );
      return res.status(200).send({
        message: "Admin login successful",
        adminId: admin.id,
        adminemail: admin.adminemail,
      });
    }

    // Check if the user is a regular user
    const [userRows] = await con.execute(
      "SELECT IDOfUser, username, useremail as userEmail, mobileNumber, balance FROM register WHERE useremail = ? AND password = ?",
      [useremail, password]
    );

    if (userRows.length === 1) {
      const user = userRows[0];
      res.cookie(
        "user",
        {
          userId: user.IDOfUser,
          username: user.username,
          useremail: user.userEmail,
          mobileNumber: user.mobileNumber,
          balance: user.balance,
        },
        { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: "Lax" }
      );
      return res.status(200).send({
        message: "Login successful",
        userId: user.IDOfUser,
        username: user.username,
        useremail: user.userEmail,
        mobileNumber: user.mobileNumber,
        balance: user.balance,
      });
    } else {
      return res.status(401).send({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send({ message: "Internal Server Error", error: error });
  }
});
app.post("/logout", (req, res) => {
  res.clearCookie("user");
  res.status(200).send({ message: "Logout successful" });
});

app.post("/send-email-otp", async (req, res) => {
  const { useremail } = req.body;
  const otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: useremail,
      subject: "OTP Verification For Name",
      text: `Your OTP code is ${otp}`,
    });

    otpStore[useremail] = otp; // otpStore should be an in-memory store
    console.log(`OTP sent successfully to ${useremail}: ${otp}`); // Log the OTP sent
    res.status(200).send({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).send({ message: "Failed to send OTP" });
  }
});

app.post("/verify-email-otp", (req, res) => {
  const { useremail, otp } = req.body;

  if (otpStore[useremail] === otp) {
    delete otpStore[useremail];
    res.status(200).send({ message: "OTP verified successfully" });
  } else {
    res.status(400).send({ message: "Invalid OTP" });
  }
});

app.post("/image-upload", async (req, res) => {
  const { userId, amount } = req.body;
  console.log("hii", userId, amount);
  try {
    await con.execute(
      "INSERT INTO uploadimages (userId, amount) VALUES (?, ?)",
      [userId, amount]
    );
    res.status(201).send({ message: "Request Created" });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).send({ message: "Internal Server Error", error: error });
  }
});

app.get("/all-users", async (req, res) => {
  try {
    // Query all users from the database
    const [usersRows] = await con.execute("SELECT * FROM register");

    // Send the users data as a response
    res.status(200).json(usersRows);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/payment", async (req, res) => {
  const user = req.cookies.user;

  if (!user || !user.userId) {
    return res.status(401).send("Unauthorized: No user ID found in cookies");
  }

  const { amount } = req.body;
  if (!amount) {
    return res.status(400).send("Bad Request: Amount is required");
  }

  try {
    await con.execute(
      "INSERT INTO uploadimages (userId, amount, status) VALUES (?, ?, 'pending')",
      [user.userId, amount]
    );

    res.status(200).send("Payment processed successfully");
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).send("Error processing payment");
  }
});

app.get("/api/payments/pending", async (req, res) => {
  try {
    const [rows] = await con.execute(
      "SELECT id, userId, amount FROM uploadimages WHERE status = 'pending'"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching pending payments:", error);
    res.status(500).send("Error fetching pending payments.");
  }
});
app.post("/api/payments/approve", async (req, res) => {
  const { id } = req.body;
  try {
    // Fetch the payment details
    const [paymentRows] = await con.execute(
      "SELECT * FROM uploadimages WHERE id = ?",
      [id]
    );
    if (paymentRows.length === 0) {
      throw new Error("Payment not found");
    }
    const payment = paymentRows[0];

    // Approve the payment
    await con.execute(
      'UPDATE uploadimages SET status = "approved" WHERE id = ?',
      [id]
    );

    // Update the user's balance using the IDOfUser from register table
    await con.execute(
      "UPDATE register SET balance = balance + ? WHERE IDOfUser = ?",
      [payment.amount, payment.userId]
    );
    await con.execute(
      "INSERT INTO rechargehistory (userId, amount, rechargeDate, status) VALUES (?, ?, CURDATE(), 'approved')",
      [payment.userId, payment.amount]
    );

    res.status(200).send({ message: "Payment approved" });
  } catch (error) {
    console.error("Error approving payment:", error);
    res.status(500).send({ message: "Error approving payment" });
  }
});

app.post("/api/payments/deny", async (req, res) => {
  const { id } = req.body;
  try {
    const [payment] = await con.execute(
      "SELECT * FROM uploadimages WHERE id = ?",
      [id]
    );
    if (payment.length === 0) {
      throw new Error("Payment not found");
    }
    await con.execute(
      'UPDATE uploadimages SET status = "denied" WHERE id = ?',
      [id]
    );

    const [paymentRows] = await con.execute(
      "SELECT userId, amount FROM uploadimages WHERE id = ?",
      [id]
    );
    const payments = paymentRows[0];
    await con.execute(
      "INSERT INTO rechargehistory (userId, amount, rechargeDate, status) VALUES (?, ?, CURDATE(), 'denied')",
      [payments.userId, payments.amount]
    );

    res.status(200).send({ message: "Payment denied" });
  } catch (error) {
    console.error("Error denying payment:", error);
    res.status(500).send({ message: "Error denying payment" });
  }
});

app.get("/api/payments/history", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).send({ message: "Missing userId parameter" });
  }

  try {
    const [paymentHistory] = await con.execute(
      'SELECT * FROM rechargeHistory WHERE status != "pending" AND userId = ?',
      [userId]
    );
    res.status(200).json(paymentHistory);
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).send({ message: "Error fetching payment history" });
  }
});
app.get("/api/payments/updatedHistory", async (req, res) => {
  try {
    const [paymentHistory] = await con.execute(
      'SELECT * FROM uploadimages WHERE status != "pending"'
    );
    res.status(200).json(paymentHistory);
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).send({ message: "Error fetching payment history" });
  }
});
app.get("/api/payemnt/history123", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    console.error("userId is undefined");
    return res.status(400).send("Bad Request: userId is required");
  }
  try {
    const [rows] = await con.execute(
      "SELECT  id, userId, amount, rechargeDate,status FROM rechargehistory WHERE userId = ?",
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching recharge payments:", error);
    res.status(500).send("Error fetching recharge payments.");
  }
});

app.post("/api/withdraw", async (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || !amount || amount <= 0) {
    return res.status(400).send({ message: "Invalid request" });
  }

  try {
    const [userRows] = await con.execute(
      "SELECT balance FROM register WHERE IDOfUser = ?",
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }
    const userBalance = userRows[0].balance;
    if (userBalance < amount) {
      return res.status(400).send({ message: "Insufficient balance" });
    }

    // Deduct amount from user balance
    await con.execute(
      "UPDATE register SET balance = balance - ? WHERE IDOfUser = ?",
      [amount, userId]
    );

    // Create a withdrawal request and insert it into withdraw history
    await con.execute(
      "INSERT INTO withdrawhistory (userId, amount, withdrawDate) VALUES (?, ?, CURDATE())",
      [userId, amount]
    );

    res
      .status(200)
      .send({ message: "Withdrawal request submitted successfully" });
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    res.status(500).send({ message: "Internal Server Error", error: error });
  }
});

app.get("/api/withdrawl/history", async (req, res) => {
  try {
    const [rows] = await con.execute(
      'SELECT id, userId, amount, withdrawDate,status FROM withdrawhistory WHERE status = "pending"'
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching withdrawal payments:", error);
    res.status(500).send("Error fetching withdrawal payments.");
  }
});
app.get("/api/show/withdrawl/history", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    console.error("userId is undefined");
    return res.status(400).send("Bad Request: userId is required");
  }
  try {
    const [rows] = await con.execute(
      'SELECT amount, withdrawDate,status FROM withdrawhistory WHERE userId = ?',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching withdrawal payments:", error);
    res.status(500).send("Error fetching withdrawal payments.");
  }
});
app.post("/api/withdrawals/accept", async (req, res) => {
  const { id } = req.body;
  try {
    const [withdrawalRows] = await con.execute(
      "SELECT * FROM withdrawhistory WHERE id = ?",
      [id]
    );
    if (withdrawalRows.length === 0) {
      return res.status(404).send({ message: "Withdrawal not found" });
    }

    const withdrawal = withdrawalRows[0];
    await con.execute(
      'UPDATE withdrawhistory SET status = "approved" WHERE id = ?',
      [id]
    );

    await con.execute(
      "UPDATE register SET balance = balance - ? WHERE IDOfUser = ?",
      [withdrawal.amount, withdrawal.userId]
    );

    res.status(200).send({ message: "Withdrawal accepted" });
  } catch (error) {
    console.error("Error accepting withdrawal:", error);
    res.status(500).send({ message: "Error accepting withdrawal" });
  }
});
app.get("/api/withdrawl/processed-history", async (req, res) => {
  try {
    const [paymentHistory] = await con.execute(
      'SELECT * FROM withdrawhistory WHERE status != "pending"'
    );
    res.status(200).json(paymentHistory);
  } catch (error) {
    console.error("Error fetching withdrawal history:", error);
    res.status(500).send({ message: "Error fetching withdrawal history" });
  }
});
app.post("/api/withdrawals/deny", async (req, res) => {
  const { id } = req.body;
  try {
    // Fetch the withdrawal details
    const [withdrawalRows] = await con.execute(
      "SELECT * FROM withdrawhistory WHERE id = ?",
      [id]
    );
    if (withdrawalRows.length === 0) {
      return res.status(404).send({ message: "Withdrawal not found" });
    }

    const withdrawal = withdrawalRows[0];
    const { userId, amount } = withdrawal;

    // Update the withdrawal status to 'denied'
    await con.execute(
      'UPDATE withdrawhistory SET status = "denied" WHERE id = ?',
      [id]
    );

    // Fetch the user's current balance
    const [userRows] = await con.execute(
      "SELECT balance FROM register WHERE IDOfUser = ?",
      [userId]
    );
    if (userRows.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    const user = userRows[0];
    const currentBalance = parseFloat(user.balance);
    const withdrawalAmount = parseFloat(amount);
    const newBalance = currentBalance + withdrawalAmount;

    // Update the user's balance
    await con.execute(
      "UPDATE register SET balance = ? WHERE IDOfUser = ?",
      [newBalance.toFixed(2), userId]
    );

    res.status(200).send({ message: "Withdrawal denied and balance updated" });
  } catch (error) {
    console.error("Error denying withdrawal:", error);
    res.status(500).send({ message: "Error denying withdrawal" });
  }
});

app.get("/api/balance/:userId", async (req, res) => {
  const userId = req.params.userId;
  if (!userId) {
    console.error("userId is undefined");
    return res.status(400).send("Bad Request: userId is required");
  }
  try {
    const [rows] = await con.execute(
      "SELECT balance FROM register WHERE IDOfUser = ?",
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching balance:", error);
    res.status(500).send("Error fetching balance");
  }
});

app.post("/api/bank-details", async (req, res) => {
  const { userId, accountNumber, ifscCode } = req.body;
  try {
    await con.execute(
      "INSERT INTO bankdetails (userId, accountNumber, ifscCode) VALUES (?, ?, ?)",
      [userId, accountNumber, ifscCode]
    );
    res.status(200).send({ message: "Bank Details Submitted Successfully" });
  } catch (error) {
    console.error("Error submitting bank details:", error);
    res.status(500).send({ message: "Error submitting bank details" });
  }
});

app.get("/api/bank-details/:userId", async (req, res) => {
  const { userId } = req.params; // Correctly extract userId from params

  try {
    const [rows] = await con.execute(
      "SELECT accountNumber, ifscCode FROM bankdetails WHERE userId = ?",
      [userId]
    );
    if (rows.length > 0) {
      res.status(200).send(rows[0]);
    } else {
      res.status(404).send({ message: "Bank details not found" });
    }
  } catch (error) {
    console.error("Error fetching bank details:", error);
    res.status(500).send({ message: "Error fetching bank details" });
  }
});

app.get("/api/bank", async (req, res) => {
  const { userId } = req.query; // use req.query to get the query parameter
  try {
    const [rows] = await con.execute(
      "SELECT accountNumber, ifscCode FROM bankDetails WHERE userId = ?",
      [userId]
    );
    res.json(rows[0]); // assuming you get one row per user
  } catch (error) {
    console.error("Error bank details:", error);
    res.status(500).send("Error fetching bank details");
  }
});
app.get("/api/invite/refer/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const [rows] = await con.execute(
      "SELECT userReferenceCode FROM register WHERE IDOfUser = ?",
      [userId]
    );
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching referrals:", error);
    res.status(500).send("Error fetching referrals");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
