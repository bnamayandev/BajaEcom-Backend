require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const bcrypt = require('bcrypt');
const morgan = require('morgan');
const { Pool } = require('pg');
const nodeMailer = require('nodemailer');
const { format } = require('date-fns');
const crypto = require('crypto'); // For generating reset tokens

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || '127.0.0.1';

// CREATE A PG POOL (Adjust connection config to your environment)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// CORS Configuration
const allowedOrigins = [
    'https://shopwesternbaja.com',
    'https://silver-gaufre-6f5db9.netlify.app',
    // Add other allowed origins here
];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            // Allow server-to-server or local tools with no origin
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            callback(null, origin);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Middleware
app.use(helmet());
app.use(express.json());
app.use(morgan('combined'));

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.error('No token provided');
        return res.status(401).json({ error: 'Authentication token missing.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification error:', err);
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
};

/* ==========================
   CREATE TABLES IF NOT EXISTS
   ========================== */

// Make sure you have run these once in your database to create the needed columns/tables.

// example:
// ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
// ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;

// You can run the below queries in your DB manually, or you can do them in code if needed:
const createTables = async () => {
    try {
        // Users table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        password VARCHAR(255) NOT NULL,
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMP
      );
    `);

        // Inventory table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        item_id SERIAL PRIMARY KEY,
        clothing_type VARCHAR(100) NOT NULL,
        size VARCHAR(10) NOT NULL,
        quantity_available INT NOT NULL,
        price NUMERIC(10, 2) NOT NULL DEFAULT 0,
        item_photo VARCHAR(255) NOT NULL,
        description VARCHAR(255) NOT NULL
      );
    `);

        // Orders table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        order_id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
        order_date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        pickup_date_time TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'not fulfilled',
        fulfillment_time TIMESTAMP NULL,
        staff_signoff VARCHAR(100) NULL,
        order_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
        void_time TIMESTAMP NULL
      );
    `);

        // Order items table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        order_item_id SERIAL PRIMARY KEY,
        order_id INT REFERENCES orders(order_id) ON DELETE CASCADE,
        item_id INT REFERENCES inventory(item_id) ON DELETE CASCADE,
        quantity INT NOT NULL,
        size VARCHAR(10) NOT NULL,
        item_price NUMERIC(10, 2) NOT NULL,
        total_price NUMERIC(10, 2) NOT NULL
      );
    `);

        console.log("All tables created or already exist.");
    } catch (error) {
        console.error("Error creating tables:", error);
    }
};
createTables();

/* =======================================
   SEND EMAIL HELPER (Used for order email + resets)
   ======================================= */
const sendEmail = async (options) => {
    try {
        const { email, subject, text, html } = options;

        const transporter = nodeMailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,    // e.g. "mygmail@gmail.com"
                pass: process.env.EMAIL_PASSWORD // e.g. "somePassword"
            },
        });

        const mailOptions = {
            from: `"Western Baja Racing" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: subject,
            text: text,
            html: html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.response);
        return { success: true, info };
    } catch (error) {
        console.error(`Error sending email: ${error.message}`);
        return { success: false, error: error.message };
    }
};

/* =====================
    USER AUTH ROUTES
   ===================== */

// Create a new user (Sign Up)
app.post('/signup', async (req, res) => {
    const { username, email, first_name, last_name, phone_number, password } = req.body;
    try {
        if (!username || !email || !password || !first_name || !last_name || !phone_number) {
            console.error('[SIGNUP] Missing fields.');
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // Check if the username or email already exists
        const userCheck = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (userCheck.rows.length > 0) {
            console.error(`[SIGNUP] Username or email already exists: ${username}, ${email}`);
            return res.status(400).json({ error: 'Username or email already exists.' });
        }

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert the user into the database
        const newUser = await pool.query(
            `INSERT INTO users (username, email, first_name, last_name, phone_number, password) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [username, email, first_name, last_name, phone_number, hashedPassword]
        );

        console.info(`[SIGNUP] New user created: ${newUser.rows[0].username}`);
        res.status(201).json({ message: 'Account created successfully', user: newUser.rows[0] });
    } catch (err) {
        console.error('[SIGNUP] Error during signup:', err.message);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Login route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if the email exists
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            console.error(`[LOGIN] User not found: ${email}`);
            return res.status(404).json({ error: 'User not found.' });
        }

        const user = result.rows[0];

        // Validate the password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            console.error('[LOGIN] Invalid credentials.');
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Generate JWT
        const token = jwt.sign({ user_id: user.user_id }, JWT_SECRET, { expiresIn: '2h' });
        console.info(`[LOGIN] Login successful for user: ${email}`);
        res.json({ message: 'Login successful', token });
    } catch (err) {
        console.error('[LOGIN] Error during login:', err.message);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

/* =========================
   FORGOT PASSWORD ROUTES
   ========================= */

// POST /forgot-password
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    try {
        // Check if user exists
        const userQuery = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userQuery.rows.length === 0) {
            return res.status(200).json({
                message: 'If an account with that email exists, a reset link has been sent.'
            });
        }

        const user = userQuery.rows[0];

        // Generate reset token & expiry (1 hour from now)
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

        // Update user with reset token
        await pool.query(
            `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE user_id = $3`,
            [resetToken, resetTokenExpires, user.user_id]
        );

        // Construct password reset URL (pointing to your frontend, e.g. /reset-password?token=xxx)
        const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

        // Send email with link
        const subject = 'Password Reset Request';
        const text = `
      You requested a password reset. 
      Please click this link to set a new password:
      ${resetUrl}
      This link will expire in 1 hour.
    `;
        const html = `
      <p>You requested a password reset.</p>
      <p>Please click the link below to set a new password:</p>
      <a href="${resetUrl}" target="_blank">${resetUrl}</a>
      <p>This link will expire in 1 hour.</p>
    `;

        const emailResult = await sendEmail({
            email: user.email,
            subject,
            text,
            html,
        });

        if (!emailResult.success) {
            console.error('[FORGOT-PASSWORD] Error sending email:', emailResult.error);
            return res.status(500).json({ error: 'Failed to send reset email.' });
        }

        // Always respond with success message to prevent email enumeration
        return res.status(200).json({
            message: 'If an account with that email exists, a reset link has been sent.',
        });
    } catch (error) {
        console.error('[FORGOT-PASSWORD] Error:', error.message);
        return res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// POST /reset-password
app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and newPassword are required.' });
    }

    try {
        // Look up user by reset token
        const userQuery = await pool.query(
            `SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()`,
            [token]
        );

        if (userQuery.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token.' });
        }

        const user = userQuery.rows[0];

        // Hash the new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update user password, clear token and expiration
        await pool.query(
            `UPDATE users 
       SET password = $1, 
           reset_token = NULL, 
           reset_token_expires = NULL
       WHERE user_id = $2`,
            [hashedPassword, user.user_id]
        );

        return res.status(200).json({ message: 'Password has been reset successfully.' });
    } catch (error) {
        console.error('[RESET-PASSWORD] Error:', error.message);
        return res.status(500).json({ error: 'Server error', details: error.message });
    }
});

/* ====================
   PROTECTED USER ROUTES
   ==================== */

app.get('/users', authenticateToken, async (req, res) => {
    try {
        const users = await pool.query('SELECT * FROM users');
        res.json(users.rows);
    } catch (err) {
        console.error('[USERS] Error fetching users:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

/* =====================
   SALES ROUTES
   ===================== */

// CREATE a new order with multiple items
app.post('/orders', authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { pickup_date_time, items } = req.body;

        if (!pickup_date_time || isNaN(new Date(pickup_date_time))) {
            console.error('[ORDERS] Invalid or missing pickup_date_time.');
            return res.status(400).json({ error: 'Invalid or missing pickup_date_time.' });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            console.error('[ORDERS] Items array is required and cannot be empty.');
            return res.status(400).json({ error: 'Items array is required and cannot be empty.' });
        }

        await pool.query('BEGIN'); // Begin transaction

        // Insert into orders table
        const orderResult = await pool.query(
            `INSERT INTO orders (user_id, pickup_date_time, status, order_total)
       VALUES ($1, $2, 'not fulfilled', 0) RETURNING *`,
            [user_id, pickup_date_time]
        );

        const order = orderResult.rows[0];
        let orderTotal = 0;

        // Insert items into order_items table
        for (const item of items) {
            const { item_id, quantity } = item;

            if (!item_id || !quantity) {
                throw new Error('Each item must include item_id and quantity.');
            }

            const itemResult = await pool.query(
                'SELECT price, quantity_available, size FROM inventory WHERE item_id = $1',
                [item_id]
            );

            if (itemResult.rows.length === 0) {
                throw new Error(`Item with ID ${item_id} not found.`);
            }

            const itemData = itemResult.rows[0];
            if (itemData.quantity_available < quantity) {
                throw new Error(`Insufficient quantity for item ID ${item_id}.`);
            }

            const itemPrice = parseFloat(itemData.price);
            const totalPrice = itemPrice * quantity;
            orderTotal += totalPrice;

            await pool.query(
                `INSERT INTO order_items (order_id, item_id, quantity, size, item_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [order.order_id, item_id, quantity, itemData.size, itemPrice, totalPrice]
            );

            await pool.query(
                `UPDATE inventory SET quantity_available = quantity_available - $1 WHERE item_id = $2`,
                [quantity, item_id]
            );
        }

        // Update order total
        await pool.query(
            `UPDATE orders SET order_total = $1 WHERE order_id = $2`,
            [orderTotal, order.order_id]
        );

        // Fetch user details
        const userResult = await pool.query(
            'SELECT email, first_name FROM users WHERE user_id = $1',
            [user_id]
        );

        if (userResult.rows.length === 0) {
            console.error('[ORDERS] User not found.');
            throw new Error('User not found.');
        }

        const { email, first_name } = userResult.rows[0];

        // Send "Thank you for your purchase" email
        const pickupDateFormatted = format(new Date(pickup_date_time), "MMMM d, yyyy 'at' h:mm a");
        const subject = 'Thank You For Your Purchase!';
        const text = `Dear ${first_name},

Thank you for your recent purchase with us. Your order #${order.order_id} has been successfully processed and is ready to pick up at CMLP 63 on ${pickupDateFormatted}.

Best regards,
Western Baja Racing`;

        const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Dear ${first_name},</h2>
        <p>Thank you for your recent purchase with us! We're excited to let you know that your order <strong>#${order.order_id}</strong> has been successfully processed.</p>
        <p><strong>Pickup Details:</strong></p>
        <ul>
            <li><strong>Location:</strong> CMLP 63</li>
            <li><strong>Date & Time:</strong> ${pickupDateFormatted}</li>
        </ul>
        <p>If you have any questions or need further assistance, feel free to reach out to our support team.</p>
        <p>Best regards,<br><strong>Western Baja Racing</strong></p>
        <hr>
        <p style="font-size: 0.9em; color: #555;">
            You are receiving this email because you placed an order with Western Baja Racing. If you believe this was a mistake, please contact our support team.
        </p>
      </div>
    `;

        const emailResult = await sendEmail({ email, subject, text, html });
        if (!emailResult.success) {
            console.error(`Error sending order confirmation email: ${emailResult.error}`);
            throw new Error('Failed to send order confirmation email.');
        }

        await pool.query('COMMIT'); // Commit transaction
        console.info(`[ORDERS] Order created successfully: ${order.order_id}`);

        return res.status(200).json({
            message: 'Order created successfully',
            order_id: order.order_id
        });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('[ORDERS] Error creating order:', err.message);
        return res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// GET all orders with their items (for staff dashboard)
app.get('/orders', authenticateToken, async (req, res) => {
    try {
        const ordersResult = await pool.query(`
      SELECT o.*, u.first_name, u.last_name, u.email, u.phone_number
      FROM orders o
      JOIN users u ON o.user_id = u.user_id
    `);
        const orders = ordersResult.rows;

        // Fetch order items for each order
        for (const order of orders) {
            const itemsResult = await pool.query(
                `SELECT oi.*, i.clothing_type, i.item_photo
         FROM order_items oi
         JOIN inventory i ON oi.item_id = i.item_id
         WHERE oi.order_id = $1`,
                [order.order_id]
            );
            order.items = itemsResult.rows;
        }

        res.json(orders);
    } catch (err) {
        console.error('[ORDERS] Error fetching orders:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET the current authenticated user's orders
app.get('/user/orders', authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const ordersResult = await pool.query(
            `SELECT o.*,
              (SELECT json_agg(oi)
               FROM order_items oi
               JOIN inventory i ON oi.item_id = i.item_id
               WHERE oi.order_id = o.order_id) AS items
       FROM orders o
       WHERE o.user_id = $1`,
            [user_id]
        );

        res.json(ordersResult.rows);
    } catch (err) {
        console.error('[USER ORDERS] Error fetching user orders:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get inventory (grouped by clothing type)
app.get('/inventory', authenticateToken, async (req, res) => {
    try {
        const inventoryResult = await pool.query(`
      SELECT i.item_id, i.clothing_type, i.size, i.quantity_available, i.price, i.item_photo, i.description
      FROM inventory i
      ORDER BY i.clothing_type, i.size
    `);

        const inventoryData = inventoryResult.rows;
        // Group inventory
        const groupedInventory = inventoryData.reduce((acc, item) => {
            const key = item.clothing_type;
            if (!acc[key]) {
                acc[key] = {
                    clothing_type: item.clothing_type,
                    item_photo: item.item_photo,
                    description: item.description,
                    price: item.price,
                    sizes: [],
                };
            }
            acc[key].sizes.push({
                size: item.size,
                quantity_available: item.quantity_available,
                item_id: item.item_id,
            });
            return acc;
        }, {});

        res.json(Object.values(groupedInventory));
    } catch (err) {
        console.error('[INVENTORY] Error fetching inventory:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Fulfill/unfulfill an order
app.put('/orders/:id/toggle-fulfillment', authenticateToken, async (req, res) => {
    let { id } = req.params;
    let { staff_signoff } = req.body;

    try {
        id = parseInt(id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid order_id parameter' });
        }

        const result = await pool.query('SELECT status FROM orders WHERE order_id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const currentStatus = result.rows[0].status;
        const newStatus = currentStatus === 'fulfilled' ? 'not fulfilled' : 'fulfilled';

        if (newStatus === 'fulfilled') {
            if (!staff_signoff || staff_signoff.trim() === '') {
                return res.status(400).json({ error: 'Staff signoff is required when fulfilling an order' });
            }
        } else {
            // If we revert to 'not fulfilled', clear staff_signoff
            staff_signoff = null;
        }

        const updateResult = await pool.query(
            `UPDATE orders
       SET status = $1,
           fulfillment_time = CASE WHEN $1 = 'fulfilled' THEN CURRENT_TIMESTAMP ELSE NULL END,
           staff_signoff = CASE WHEN $1 = 'fulfilled' THEN $2 ELSE NULL END
       WHERE order_id = $3
       RETURNING *`,
            [newStatus, staff_signoff, id]
        );

        console.info(`[ORDERS] Order status updated successfully: ${id}`);
        res.json({ message: 'Order status updated successfully', order: updateResult.rows[0] });
    } catch (err) {
        console.error(`[ORDERS] Error toggling fulfillment status for order_id ${id}:`, err.message);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Void/reinstate an order
app.put('/orders/:id/void', authenticateToken, async (req, res) => {
    let { id } = req.params;

    try {
        id = parseInt(id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid order_id parameter' });
        }

        const result = await pool.query('SELECT status FROM orders WHERE order_id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const currentStatus = result.rows[0].status;
        let newStatus = '';
        let voidTime = null;
        if (currentStatus === 'voided') {
            newStatus = 'not fulfilled';
            voidTime = null;
        } else {
            newStatus = 'voided';
            voidTime = new Date();
        }

        const updateResult = await pool.query(
            `UPDATE orders
       SET status = $1,
           void_time = $2
       WHERE order_id = $3
       RETURNING *`,
            [newStatus, voidTime, id]
        );

        console.info(`[ORDERS] Order void status updated successfully: ${id}`);
        res.json({ message: 'Order void status updated successfully', order: updateResult.rows[0] });
    } catch (err) {
        console.error(`[ORDERS] Error toggling void status for order_id ${id}:`, err.message);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// User cancels their own order
app.put('/orders/:id/cancel', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.user_id;

    try {
        const orderId = parseInt(id, 10);
        if (isNaN(orderId)) {
            return res.status(400).json({ error: 'Invalid order ID.' });
        }

        await pool.query('BEGIN');

        const orderResult = await pool.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
        if (orderResult.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'Order not found.' });
        }

        const order = orderResult.rows[0];
        if (order.user_id !== user_id) {
            await pool.query('ROLLBACK');
            return res.status(403).json({ error: 'You are not authorized to cancel this order.' });
        }
        if (order.status === 'fulfilled') {
            await pool.query('ROLLBACK');
            return res.status(400).json({ error: 'Cannot cancel a fulfilled order.' });
        }
        if (order.status === 'voided') {
            await pool.query('ROLLBACK');
            return res.status(400).json({ error: 'Order is already voided.' });
        }

        const updateOrderResult = await pool.query(
            `UPDATE orders
       SET status = 'voided', void_time = CURRENT_TIMESTAMP
       WHERE order_id = $1
       RETURNING *`,
            [orderId]
        );

        // Restock inventory
        const itemsResult = await pool.query(
            `SELECT * FROM order_items WHERE order_id = $1`,
            [orderId]
        );
        const items = itemsResult.rows;
        for (const item of items) {
            await pool.query(
                `UPDATE inventory
         SET quantity_available = quantity_available + $1
         WHERE item_id = $2`,
                [item.quantity, item.item_id]
            );
        }

        await pool.query('COMMIT');
        console.info(`[ORDERS] Order canceled successfully: ${orderId}`);
        res.json({ message: 'Order canceled successfully.', order: updateOrderResult.rows[0] });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(`[ORDERS] Error canceling order ${id}:`, err.message);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

/* =========================
   Auto-void unfulfilled orders 
   after 24 hours of pickup time
   ========================= */
const autoVoidOrders = async () => {
    try {
        const now = new Date();
        await pool.query(
            `UPDATE orders
       SET status = 'voided',
           void_time = $1
       WHERE status = 'not fulfilled'
         AND pickup_date_time + INTERVAL '24 hours' < $1
         AND void_time IS NULL`,
            [now]
        );
        console.info('[ORDERS] Auto-voided orders not fulfilled within 24 hours after pickup date and time.');
    } catch (err) {
        console.error('[ORDERS] Error auto-voiding orders:', err.message);
    }
};

// Run autoVoidOrders() every hour
setInterval(autoVoidOrders, 60 * 60 * 1000);

// Catch-all 404
app.use((req, res, next) => {
    res.status(404).json({ error: 'Endpoint not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'An unexpected error occurred.' });
});

app.listen(port, host, () => console.log(`Server has started on port ${port}`));
