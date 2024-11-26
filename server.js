require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const bcrypt = require('bcrypt');
const morgan = require('morgan');
const pool = require('./db'); // Ensure this points to your PostgreSQL connection file
const port = process.env.PORT || 3000; // Fallback to 3000 if PORT is not defined
const app = express();

// Middleware
app.use(cors());
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
    const { username, first_name, last_name, phone_number, password } = req.body;

    try {
        // Validate request body
        if (!username || !password || !first_name || !last_name || !phone_number) {
            console.error('[SIGNUP] Missing fields.');
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // Check if the username already exists
        const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userCheck.rows.length > 0) {
            console.error(`[SIGNUP] Username already exists: ${username}`);
            return res.status(400).json({ error: 'Username already exists.' });
        }

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert the user into the database
        const newUser = await pool.query(
            `INSERT INTO users (username, first_name, last_name, phone_number, password) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [username, first_name, last_name, phone_number, hashedPassword]
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
    const { username, password } = req.body;

    try {
        // Check if the username exists
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            console.error(`[LOGIN] User not found: ${username}`);
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
        console.info(`[LOGIN] Login successful for user: ${username}`);
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

// Create a new order with multiple items
app.post('/orders', authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.user_id; // Get user_id from the authenticated user
        const { pickup_date_time, items } = req.body;
        // items is an array of objects [{ item_id, quantity, size }]

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

        // Begin transaction
        await pool.query('BEGIN');

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
            const { item_id, quantity, size } = item;

            // Validate item data
            if (!item_id || !quantity || !size) {
                throw new Error('Each item must include item_id, quantity, and size.');
            }

            const itemResult = await pool.query('SELECT price, quantity_available FROM inventory WHERE item_id = $1', [item_id]);

            if (itemResult.rows.length === 0) {
                throw new Error(`Item with ID ${item_id} not found.`);
            }

            const itemData = itemResult.rows[0];

            // Check if sufficient quantity is available
            if (itemData.quantity_available < quantity) {
                throw new Error(`Insufficient quantity for item ID ${item_id}.`);
            }

            const itemPrice = parseFloat(itemData.price);
            const totalPrice = itemPrice * quantity;
            orderTotal += totalPrice;

            await pool.query(
                `INSERT INTO order_items (order_id, item_id, quantity, size, item_price, total_price)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [order.order_id, item_id, quantity, size, itemPrice, totalPrice]
            );

            // Update inventory quantity
            await pool.query(
                `UPDATE inventory SET quantity_available = quantity_available - $1
                 WHERE item_id = $2`,
                [quantity, item_id]
            );
        }

        // Update order total
        await pool.query(
            `UPDATE orders SET order_total = $1 WHERE order_id = $2`,
            [orderTotal, order.order_id]
        );

        // Commit transaction
        await pool.query('COMMIT');

        console.info(`[ORDERS] Order created successfully: ${order.order_id}`);
        res.json({ message: 'Order created successfully', order_id: order.order_id });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('[ORDERS] Error creating order:', err.message);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get all orders with their items
app.get('/orders', authenticateToken, async (req, res) => {
    try {
        const ordersResult = await pool.query('SELECT * FROM orders');
        const orders = ordersResult.rows;

        // Fetch order items for each order
        for (const order of orders) {
            const itemsResult = await pool.query(
                `SELECT oi.*, i.clothing_type, i.itemPhoto
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

// INVENTORY ROUTES

// Get total inventory
app.get('/inventory', authenticateToken, async (req, res) => {
    try {
        const inventory = await pool.query('SELECT * FROM inventory');
        res.json(inventory.rows);
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

// Start the server
app.listen(port, () => console.log(`Server has started on port ${port}`));