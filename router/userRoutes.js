// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const con = require("../db/db");
const otpGenerator = require("otp-generator");
const nodemailer = require("nodemailer");

const otpStore = {};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function generateRandomUserId() {
  const userId = Math.floor(1000000000 + Math.random() * 9000000000);
  return userId;
}

router.post("/register", async (req, res) => {
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
    const userId = await generateRandomUserId();
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

router.post("/login", async (req, res) => {
  const { useremail, password } = req.body;

  if (!useremail || !password) {
    return res.status(400).send({ message: "Email and password are required" });
  }

  try {
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

router.post("/logout", (req, res) => {
  res.clearCookie("user");
  res.status(200).send({ message: "Logout successful" });
});

router.post("/send-email-otp", async (req, res) => {
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

    otpStore[useremail] = otp;
    console.log(`OTP sent successfully to ${useremail}: ${otp}`);
    res.status(200).send({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).send({ message: "Failed to send OTP" });
  }
});

router.post("/verify-email-otp", (req, res) => {
  const { useremail, otp } = req.body;

  if (otpStore[useremail] === otp) {
    delete otpStore[useremail];
    res.status(200).send({ message: "OTP verified successfully" });
  } else {
    res.status(400).send({ message: "Invalid OTP" });
  }
});

router.post("/upload-image", async (req, res) => {
  const { userId, image } = req.body;

  try {
    await con.execute(
      "INSERT INTO uploadimages (userId, image) VALUES (?, ?)",
      [userId, image]
    );

    res.status(200).send({ message: "Image uploaded successfully" });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).send({ message: "Internal Server Error", error: error });
  }
});

module.exports = router;
