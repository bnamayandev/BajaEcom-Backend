require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const bcrypt = require('bcrypt');
const morgan = require('morgan');
const pool = require('./db'); // Ensure this points to your PostgreSQL connection file
const nodeMailer = require('nodemailer');
const { format } = require('date-fns');

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || '127.0.0.1';

// CORS Configuration
const allowedOrigins = [
    'https://shopwesternbaja.com',
    'https://silver-gaufre-6f5db9.netlify.app', // Add other allowed origins here
];

const corsOptions = {
    origin: (origin, callback) => {
        if (allowedOrigins.includes(origin)) {
            callback(null, origin); // Allow the origin
        } else {
            callback(new Error('Not allowed by CORS')); // Deny other origins
        }
    },
    optionsSuccessStatus: 200, // For legacy browser support
};

app.use(cors(corsOptions));


//Middleware
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

// USER ROUTES

// Create a new user
app.post('/signup', async (req, res) => {
    const { username, email, first_name, last_name, phone_number, password } = req.body;

    try {
        // Validate request body
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

// PROTECTED ROUTES

// Get all users (protected)
app.get('/users', authenticateToken, async (req, res) => {
    try {
        const users = await pool.query('SELECT * FROM users');
        res.json(users.rows);
    } catch (err) {
        console.error('[USERS] Error fetching users:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// SALES ROUTES

const sendEmail = async (emailData) => {
    const { email, first_name, orderId, pickup_date_time } = emailData;

    console.log(`Preparing to send email to: ${email}`);
    console.log(`Sender's email: ${process.env.EMAIL_USER}`);

    try {
        // Format the pickup date and time
        const pickupDate = new Date(pickup_date_time);
        const formattedPickupDate = format(pickupDate, "MMMM d, yyyy 'at' h:mm a");

        // Configure the transporter
        const transporter = nodeMailer.createTransport({
            service: 'gmail', // You can use 'gmail' as a shorthand for SMTP settings
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD // Ensure this matches your environment variables
            }
        });

        // Define the email options with improved formatting
        const mailOptions = {
            from: `"Western Baja SAE" <${process.env.EMAIL_USER}>`, // Add a friendly name
            to: email,
            subject: 'Thank You For Your Purchase!',
            text: `Dear ${first_name},

Thank you for your recent purchase with us. Your order #${orderId} has been successfully processed and is ready to pick up at CMLP 63 on ${formattedPickupDate}.

Best regards,
Western Baja SAE`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h2>Dear ${first_name},</h2>
                    <p>Thank you for your recent purchase with us! We're excited to let you know that your order <strong>#${orderId}</strong> has been successfully processed.</p>
                    <p><strong>Pickup Details:</strong></p>
                    <ul>
                        <li><strong>Location:</strong> CMLP 63</li>
                        <li><strong>Date & Time:</strong> ${formattedPickupDate}</li>
                    </ul>
                    <p>If you have any questions or need further assistance, feel free to reach out to our support team.</p>
                    <p>Best regards,<br><strong>Western Baja SAE</strong></p>
                    <hr>
                    <p style="font-size: 0.9em; color: #555;">
                        You are receiving this email because you placed an order with Western Baja SAE. If you believe this was a mistake, please contact our support team.
                    </p>
                </div>
            `
        };

        // Send the email
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent: ${info.response}`);
        return { success: true, info };
    } catch (error) {
        console.error(`Error sending email: ${error.message}`);
        return { success: false, error: error.message };
    }
};

// Create a new order with multiple items
app.post('/orders', authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { pickup_date_time, items } = req.body;

        // Validate pickup_date_time
        if (!pickup_date_time || isNaN(new Date(pickup_date_time))) {
            console.error('[ORDERS] Invalid or missing pickup_date_time.');
            return res.status(400).json({ error: 'Invalid or missing pickup_date_time.' });
        }

        // Validate items array
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

        const userResult = await pool.query(
            'SELECT email, first_name FROM users WHERE user_id = $1',
            [user_id]
        );

        if (userResult.rows.length === 0) {
            console.error('[ORDERS] User not found.');
            throw new Error('User not found.');
        }

        const { email, first_name } = userResult.rows[0];
        console.log(email, first_name);

        const emailResult = await sendEmail({
            email,
            first_name,
            orderId: order.order_id,
            pickup_date_time
        });

        if (!emailResult.success) {
            console.error(`Error sending email: ${emailResult.error}`);
            throw new Error('Failed to send email.');
        }

        await pool.query('COMMIT'); // Commit transaction
        console.info(`[ORDERS] Order created successfully: ${order.order_id}`);

        return res.status(200).json({
            message: 'Order created successfully',
            order_id: order.order_id
        });
    } catch (err) {
        await pool.query('ROLLBACK'); // Rollback only if a transaction was started
        console.error('[ORDERS] Error creating order:', err.message);
        return res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get all orders with their items
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

// Get the current authenticated user's orders
app.get('/user/orders', authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.user_id;

        // Fetch orders belonging to the authenticated user
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

// INVENTORY ROUTES

// Get total inventory
app.get('/inventory', authenticateToken, async (req, res) => {
    try {
        const inventoryResult = await pool.query(`
            SELECT i.item_id, i.clothing_type, i.size, i.quantity_available, i.price, i.item_photo, i.description
            FROM inventory i
            ORDER BY i.clothing_type, i.size
        `);

        const inventoryData = inventoryResult.rows;

        // Group inventory items by clothing_type
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

        // Check if the order exists
        const result = await pool.query('SELECT status FROM orders WHERE order_id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const currentStatus = result.rows[0].status;

        // Determine new status
        const newStatus = currentStatus === 'fulfilled' ? 'not fulfilled' : 'fulfilled';

        // If setting to 'fulfilled', require staff_signoff
        if (newStatus === 'fulfilled') {
            if (!staff_signoff || staff_signoff.trim() === '') {
                return res.status(400).json({ error: 'Staff signoff is required when fulfilling an order' });
            }
        } else {
            // Ensure staff_signoff is null when not fulfilling
            staff_signoff = null;
        }

        // Update the order with the new status and staff_signoff
        const updateResult = await pool.query(
            `UPDATE orders
             SET status = $1::VARCHAR(20),
                 fulfillment_time = CASE WHEN $1::VARCHAR(20) = 'fulfilled'::VARCHAR(20) THEN CURRENT_TIMESTAMP ELSE NULL END,
                 staff_signoff = CASE WHEN $1::VARCHAR(20) = 'fulfilled'::VARCHAR(20) THEN $2 ELSE NULL END
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

        // Check if the order exists
        const result = await pool.query('SELECT status FROM orders WHERE order_id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const currentStatus = result.rows[0].status;

        // Determine new status
        let newStatus = '';
        let voidTime = null;
        if (currentStatus === 'voided') {
            newStatus = 'not fulfilled';
            voidTime = null;
        } else {
            newStatus = 'voided';
            voidTime = new Date();
        }

        // Update the order with the new status and void_time
        const updateResult = await pool.query(
            `UPDATE orders
             SET status = $1::VARCHAR(20),
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

// Email sender
// POST endpoint to trigger email
app.post('/send-email', async (req, res) => {
    const { to, name, orderId, date } = req.body;

    // Validate the request body
    if (!to) {
        return res.status(400).json({ error: 'Missing required fields: to' });
    }

    // Trigger the email-sending function
    const result = await sendEmail({ email: to, first_name: name, orderId, pickup_date_time: date });

    if (result.success) {
        res.status(200).json({ message: 'Email sent successfully', info: result.info });
    } else {
        res.status(500).json({ error: 'Failed to send email', details: result.error });
    }
});

// NEW: Cancel an order
app.put('/orders/:id/cancel', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.user_id;

    try {
        const orderId = parseInt(id, 10);
        if (isNaN(orderId)) {
            return res.status(400).json({ error: 'Invalid order ID.' });
        }

        // Start a transaction
        await pool.query('BEGIN');

        // Fetch the order
        const orderResult = await pool.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);

        if (orderResult.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'Order not found.' });
        }

        const order = orderResult.rows[0];

        // Check if the order belongs to the user
        if (order.user_id !== user_id) {
            await pool.query('ROLLBACK');
            return res.status(403).json({ error: 'You are not authorized to cancel this order.' });
        }

        // Check if the order is already fulfilled or voided
        if (order.status === 'fulfilled') {
            await pool.query('ROLLBACK');
            return res.status(400).json({ error: 'Cannot cancel a fulfilled order.' });
        }

        if (order.status === 'voided') {
            await pool.query('ROLLBACK');
            return res.status(400).json({ error: 'Order is already voided.' });
        }

        // Update the order status to 'voided' and set void_time
        const updateOrderResult = await pool.query(
            `UPDATE orders
             SET status = 'voided',
                 void_time = CURRENT_TIMESTAMP
             WHERE order_id = $1
             RETURNING *`,
            [orderId]
        );

        // Fetch all items in the order
        const itemsResult = await pool.query(
            `SELECT * FROM order_items WHERE order_id = $1`,
            [orderId]
        );

        const items = itemsResult.rows;

        // Restock the inventory
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

// Function to automatically void orders not fulfilled within 24 hours after pickup date and time
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

// Schedule the autoVoidOrders function to run every hour
setInterval(autoVoidOrders, 60 * 60 * 1000); // Every hour

// Catch-all 404 handler
app.use((req, res, next) => {
    res.status(404).json({ error: 'Endpoint not found.' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'An unexpected error occurred.' });
});

// Start the server
app.listen(port, host, () => console.log(`Server has started on port ${port}`));
