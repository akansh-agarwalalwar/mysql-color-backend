// db/db.js
const mysql = require("mysql2/promise");

const con = mysql.createPool({
  user: "root",
  password: "",
  host: "localhost",
  database: "PERFECTORSE",
});

async function ensureTablesExist() {
  try {
    const createUserTableQuery = `
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
    await con.execute(createUserTableQuery);
    console.log("Table 'register' ensured in the database.");

    const createUploadImagesTableQuery = `
      CREATE TABLE IF NOT EXISTS uploadimages (
        IDOfUser INT PRIMARY KEY,
        image LONGBLOB
      );
    `;
    await con.execute(createUploadImagesTableQuery);
    console.log("Table 'uploadimages' ensured in the database.");

    const createAdminTableQuery = `
      CREATE TABLE IF NOT EXISTS admin (
        adminId INT AUTO_INCREMENT PRIMARY KEY,
        adminemail VARCHAR(255) NOT NULL UNIQUE,
        adminPassword VARCHAR(255) NOT NULL
      );
    `;
    await con.execute(createAdminTableQuery);
    console.log("Table 'admin' ensured in the database.");

    // Insert predefined admin accounts
    const predefinedAdmins = [
      { adminemail: "akansh@gmail.com", adminPassword: "akansh" },
      { adminemail: "aka@gmail.com", adminPassword: "akansh" }
    ];

    for (const admin of predefinedAdmins) {
      await con.execute(
        "INSERT IGNORE INTO admin (adminemail, adminPassword) VALUES (?, ?)",
        [admin.adminemail, admin.adminPassword]
      );
    }
    console.log("Predefined admin accounts inserted.");
  } catch (err) {
    console.error("Error ensuring the tables:", err);
  }
}

ensureTablesExist();

module.exports = con;
