# Payment System Quick Start Guide

## For Students

### Making a Payment

1. Log in to your student account
2. Navigate to **Payments** from the sidebar or dashboard
3. Click **Make Payment**
4. Fill in the payment details:
   - Amount
   - Semester
   - Category (Tuition Fee, Exam Fee, etc.)
   - Payment Method
   - Optional description
5. Review the payment summary
6. Click **Proceed to Pay**
7. You'll receive a payment confirmation with Payment ID and Transaction ID

### Viewing Payment History

1. Go to **Payments** → **Payment History**
2. View all your transactions
3. Filter by status or category
4. Click **View** to see full details
5. Click **Receipt** to download PDF

### Downloading Receipts

**Method 1: From Payment History**
- Click the **Receipt** button next to any payment

**Method 2: From Payment Details**
- View payment details
- Click **Download Receipt** or **Print Receipt**

## For Developers

### Quick Setup

1. **Backend is ready** - Payment routes are registered in `server/index.js`
2. **Frontend pages created** - Located in `client/dashboard/`
3. **Navigation updated** - Payments link added to student sidebar
4. **Dependencies installed** - PDFKit is installed

### Testing the Payment System

```bash
# 1. Ensure Firebase is configured
# Check server/serviceAccountKey.json exists

# 2. Start the server
npm start

# 3. Navigate to student dashboard
# Go to http://localhost:PORT/dashboard/student.html

# 4. Access payment pages:
# - Make Payment: /dashboard/student-payment-make.html
# - Payment History: /dashboard/student-payment-history.html
# - Payment Details: /dashboard/student-payment-details.html?id=PAYMENT_ID
```

### API Testing with cURL

```bash
# Get access token first (login)
TOKEN="your_jwt_token"

# Create a payment
curl -X POST http://localhost:3000/api/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "semester": "Semester 1",
    "category": "Tuition Fee",
    "paymentMethod": "UPI",
    "description": "Test payment"
  }'

# Get payment history
curl -X GET http://localhost:3000/api/payments \
  -H "Authorization: Bearer $TOKEN"

# Get payment stats
curl -X GET http://localhost:3000/api/payments/stats \
  -H "Authorization: Bearer $TOKEN"

# Get payment details
curl -X GET http://localhost:3000/api/payments/PAYMENT_ID \
  -H "Authorization: Bearer $TOKEN"

# Download receipt
curl -X GET http://localhost:3000/api/payments/PAYMENT_ID/receipt \
  -H "Authorization: Bearer $TOKEN" \
  --output receipt.pdf
```

### Adding Payment Gateway Integration

To integrate a real payment gateway (Razorpay example):

1. **Install Razorpay SDK**
```bash
npm install razorpay
```

2. **Update payment.controller.js**
```javascript
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create Razorpay order before payment
const createRazorpayOrder = async (amount) => {
  const options = {
    amount: amount * 100, // amount in paise
    currency: 'INR',
    receipt: `receipt_${Date.now()}`
  };
  return await razorpay.orders.create(options);
};
```

3. **Update createPayment endpoint**
```javascript
// Create Razorpay order
const razorpayOrder = await createRazorpayOrder(formData.amount);

// Return order ID to frontend
res.json({
  success: true,
  orderId: razorpayOrder.id,
  amount: razorpayOrder.amount
});
```

4. **Update frontend (student-payment-make.js)**
```javascript
// Add Razorpay checkout
const options = {
  key: 'YOUR_RAZORPAY_KEY_ID',
  amount: response.amount,
  currency: 'INR',
  order_id: response.orderId,
  handler: function(response) {
    // Verify payment and save to database
    verifyPayment(response);
  }
};
const rzp = new Razorpay(options);
rzp.open();
```

### Common Issues and Solutions

#### Issue: "Payment not found"
**Solution**: Check if the payment ID exists in Firestore and belongs to the logged-in user.

#### Issue: "Failed to download receipt"
**Solution**: Ensure PDFKit is installed and the payment exists.

#### Issue: "Authentication error"
**Solution**: Check if the JWT token is valid and not expired.

#### Issue: "Cannot read property of undefined"
**Solution**: Verify Firebase is initialized and the user object has required fields.

### Directory Structure for Custom Gateway

```
server/
├── services/
│   └── payment-gateway.service.js  # Create this for gateway logic
├── webhooks/
│   └── payment-webhook.js          # Create this for gateway callbacks
└── controllers/
    └── payment.controller.js       # Already exists
```

### Environment Variables to Add

```env
# Payment Gateway Configuration
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
PAYMENT_WEBHOOK_SECRET=your_webhook_secret

# Payment Settings
PAYMENT_CURRENCY=INR
PAYMENT_PROCESSING_FEE_PERCENT=0
PAYMENT_SUCCESS_URL=http://localhost:3000/dashboard/student-payment-history.html
PAYMENT_CANCEL_URL=http://localhost:3000/dashboard/student-payment-make.html
```

### Customization Examples

#### Change Payment Categories
Edit `client/dashboard/student-payment-make.html`:
```html
<select id="category" name="category">
  <option value="Your New Category">Your New Category</option>
</select>
```

#### Change Receipt Design
Edit `server/controllers/payment.controller.js` in the `downloadReceipt` function:
```javascript
pdfDoc
  .fontSize(24)
  .text('YOUR COLLEGE NAME', { align: 'center' })
  .fontSize(18)
  .text('Official Payment Receipt', { align: 'center' });
```

#### Add Email Notifications
Install nodemailer and add to `createPayment`:
```javascript
const nodemailer = require('nodemailer');

// After saving payment
await sendPaymentEmail(payment);

async function sendPaymentEmail(payment) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: 'noreply@iter.edu',
    to: payment.studentEmail,
    subject: `Payment Confirmation - ${payment.paymentId}`,
    html: `Payment of ₹${payment.amount} received successfully.`
  });
}
```

### Performance Tips

1. **Caching**: Payment stats can be cached for 5 minutes
2. **Pagination**: Use pagination for large payment histories
3. **Indexing**: Create Firestore indexes on `userId` and `paymentDate`
4. **Compression**: PDF receipts can be compressed

### Security Best Practices

1. ✅ Always validate user owns the payment before showing details
2. ✅ Never expose payment gateway secrets in frontend
3. ✅ Use HTTPS in production
4. ✅ Validate all inputs on backend
5. ✅ Log all payment transactions
6. ✅ Implement rate limiting on payment endpoints
7. ✅ Use secure payment IDs (hard to guess)

### Monitoring and Logging

Add to `payment.controller.js`:
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'payments.log' })
  ]
});

// Log all payment creations
logger.info('Payment created', {
  paymentId: payment.paymentId,
  userId: userId,
  amount: payment.amount,
  timestamp: new Date()
});
```

### Next Steps

1. ✅ Payment system is ready to use (with mock payments)
2. 🔄 Integrate real payment gateway (Razorpay/Paytm/Stripe)
3. 🔄 Add email notifications
4. 🔄 Add admin reconciliation dashboard
5. 🔄 Add payment analytics
6. 🔄 Add payment reminders
7. 🔄 Add installment support

## Support Resources

- **Full Documentation**: See `PAYMENT_SYSTEM_DOCUMENTATION.md`
- **API Reference**: Check Firestore collection structure
- **Frontend Components**: Review existing student pages for patterns
- **Backend Patterns**: Review other controllers for consistency

## Quick Commands

```bash
# Check syntax
node -c server/controllers/payment.controller.js
node -c server/routes/payment.routes.js

# Test API (requires running server)
npm start

# View logs
tail -f payments.log

# Check Firebase connection
node -e "require('./server/database/firebase').db.collection('payments').limit(1).get().then(() => console.log('✓ Connected'))"
```

## Need Help?

1. Check console for errors
2. Review `PAYMENT_SYSTEM_DOCUMENTATION.md`
3. Check Firestore for data
4. Verify JWT token is valid
5. Test with cURL before testing in browser
