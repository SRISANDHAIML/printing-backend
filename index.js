// index.js
const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const pdf = require('pdf-parse');
const razorpay = require('razorpay');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// MySQL Connection
const db = mysql.createPool({
    host: 'localhost', // MySQL host
    user: 'root', // MySQL username
    password: 'srisanth90800', // MySQL password
    database: 'PrintingApp', // Your database name
});

// Razorpay Configuration
const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// File Upload
const upload = multer({ dest: 'uploads/' });

// Order Model (Schema)
const createOrderTable = `
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    studentName VARCHAR(255) NOT NULL,
    rollNumber VARCHAR(255) NOT NULL,
    classroomNumber VARCHAR(255) NOT NULL,
    blockName VARCHAR(255) NOT NULL,
    pdfPath VARCHAR(255) NOT NULL,
    printType ENUM('blackWhite', 'color', 'postal') NOT NULL,
    numberOfPages INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    paymentStatus ENUM('Pending', 'Paid') DEFAULT 'Pending'
);`;

db.query(createOrderTable, (err) => {
    if (err) console.error('Error creating table:', err);
});

// Upload Endpoint
app.post('/upload', upload.single('pdfFile'), (req, res) => {
    const { studentName, rollNumber, classroomNumber, blockName, printType } = req.body;
    const dataBuffer = fs.readFileSync(req.file.path);

    pdf(dataBuffer).then(data => {
        const pages = data.numpages;
        let price = 0;

        switch (printType) {
            case 'blackWhite':
                price = pages * 0.1;
                break;
            case 'color':
                price = pages * 0.25;
                break;
            case 'postal':
                price = pages * 0.5;
                break;
        }

        const sql = `INSERT INTO orders (studentName, rollNumber, classroomNumber, blockName, pdfPath, printType, numberOfPages, price) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [studentName, rollNumber, classroomNumber, blockName, req.file.path, printType, pages, price];

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error('Error saving order to the database:', err);
                return res.status(500).json({ error: 'Failed to save order' });
            }

            const orderId = result.insertId; // Get the inserted order ID

            // Create Razorpay Order
            const options = {
                amount: price * 100, // Amount in the smallest currency unit
                currency: "INR",
                receipt: `${orderId}`, // Receipt ID
                payment_capture: 1 // Auto capture
            };

            razorpayInstance.orders.create(options, (err, order) => {
                if (err) {
                    console.error('Error creating Razorpay order:', err);
                    return res.status(500).json({ error: 'Failed to create payment order' });
                }
                res.json({ orderId: order.id, amount: order.amount });
            });
        });
    });
});

// Payment Verification Endpoint
app.post('/payment/verify', (req, res) => {
    const { orderId, paymentId, signature } = req.body;
    const crypto = require('crypto');

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(orderId + '|' + paymentId);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature === signature) {
        const sql = `UPDATE orders SET paymentStatus = 'Paid' WHERE id = ?`;
        db.query(sql, [orderId], (err, result) => {
            if (err) {
                console.error('Error updating order status:', err);
                return res.status(500).json({ error: 'Failed to update order status' });
            }
            res.json({ message: 'Payment verified successfully-you will receive your order soon' });
        });
    } else {
        res.status(400).json({ error: 'Invalid signature' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});




