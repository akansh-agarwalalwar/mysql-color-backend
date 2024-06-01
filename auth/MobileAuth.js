const accountSid = 'AC6b540ca3d1db1ada63d421de5a0b611c';
const authToken = 'ede4a5bd8f07a1d5ad6f6f80dff12353';
const client = require('twilio')(accountSid, authToken);
const otpStore = {}; // Store OTPs temporarily

const sendVerificationCode = async (req, res) => {
  const  mobileNumber  = req.body.mobileNumber;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await client.messages.create({
      body: `Your OTP Verification code is ${otp}`,
      from: '+13256320066',
      to:mobileNumber,

    });

    otpStore[mobileNumber] = otp;
    res.status(200).send({ message: 'OTP sent successfully' });
    console.log(otp)
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).send({ message: 'Failed to send OTP' });
  }
};

const verifyCode = async (req, res) => {
  const { mobileNumber, code } = req.body;

  if (otpStore[mobileNumber] === code) {
    delete otpStore[mobileNumber]; // OTP verified, remove from store
    res.status(200).send({ message: 'OTP verified successfully' });
  } else {
    res.status(400).send({ message: 'Invalid OTP' });
  }
};

module.exports = {
  sendVerificationCode,
  verifyCode,
};
