const express = require('express');
const router = express.Router();
const { sendEnquiryConfirmation } = require('../utils/email');

// POST /api/enquiries/confirm
// Sends confirmation email to client + notification to admin/landlord
router.post('/confirm', async (req, res) => {
  try {
    const { clientName, clientEmail, clientPhone, countryCode, message, preferredContact, listing } = req.body;

    if (!clientName || !clientEmail || !listing) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const fullPhone = countryCode && clientPhone ? `${countryCode}${clientPhone.replace(/^0/, '')}` : clientPhone;

    await sendEnquiryConfirmation({
      clientName,
      clientEmail,
      clientPhone: fullPhone,
      message,
      preferredContact,
      listing
    });

    res.json({ success: true, message: 'Confirmation sent.' });
  } catch (err) {
    console.error('Enquiry confirmation error:', err);
    // Don't expose internal errors — still return success so UX isn't blocked
    res.json({ success: true, message: 'Enquiry received.' });
  }
});

module.exports = router;
