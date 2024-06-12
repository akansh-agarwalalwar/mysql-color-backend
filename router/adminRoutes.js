// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");

const con = mysql.createPool({
  user: "root",
  password: "Akansh@2003",
  host: "localhost",
  database: "PERFECTORSE",
});

router.post("/admin-login", async (req, res) => {
  const { adminemail, adminPassword } = req.body;

  if (!adminemail || !adminPassword) {
    return res.status(400).send({ message: "Admin email and password are required" });
  }

  try {
    const [adminRows] = await con.execute(
      "SELECT adminId, adminemail FROM admin WHERE adminemail = ? AND adminPassword = ?",
      [adminemail, adminPassword]
    );

    if (adminRows.length === 1) {
      const admin = adminRows[0];
      res.cookie(
        "admin",
        {
          adminId: admin.adminId,
          adminemail: admin.adminemail,
        },
        { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: "Lax" }
      );
      return res.status(200).send({
        message: "Admin login successful",
        adminId: admin.adminId,
        adminemail: admin.adminemail,
      });
    } else {
      return res.status(401).send({ message: "Invalid admin email or password" });
    }
  } catch (error) {
    console.error("Error during admin login:", error);
    res.status(500).send({ message: "Internal Server Error", error: error });
  }
});

module.exports = router;
