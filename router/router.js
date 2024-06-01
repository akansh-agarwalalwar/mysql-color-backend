const express = require('express');
const router = express.Router()
const auth = require('../auth/MobileAuth');

router.post('/send-code', auth.sendVerificationCode);
router.post('/verify-code', auth.verifyCode);

module.exports = router;
