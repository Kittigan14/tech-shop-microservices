const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(express.json());

const payments = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        payments: payments.size,
        timestamp: new Date().toISOString()
    });
});

// Endpoint สำหรับการชำระเงิน
app.post('/payments/checkout', (req, res) => {
    const { userId, totalAmount } = req.body;
    if (!userId || !totalAmount) {
        return res.status(400).json({ error: 'ต้องมี userId และ totalAmount' });
    }

    // Simulate payment processing (success every time for now)
    const transactionId = uuidv4();
    const payment = {
        transactionId,
        userId,
        totalAmount,
        date: new Date().toISOString(),
        status: 'success'
    };

    payments.set(transactionId, payment);
    console.log(`✅ Payment success for user ${userId}, Transaction ID: ${transactionId}`);

    res.status(200).json({
        status: 'success',
        message: 'การชำระเงินสำเร็จ',
        transactionId
    });
});

app.get('/payments/stats', (req, res) => {
    const totalPayments = payments.size;
    const totalAmount = Array.from(payments.values()).reduce((sum, p) => sum + p.totalAmount, 0);

    res.json({
        totalPayments,
        totalAmount,
        lastPayment: payments.size > 0 ? Array.from(payments.values()).pop() : null
    });
});

// Start the server
const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
    console.log(`💳 Payment Service running on port ${PORT}`);
});