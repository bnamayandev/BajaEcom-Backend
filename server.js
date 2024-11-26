// Load environment variables from .env file
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
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403);
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
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if the username already exists
        const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
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

        res.status(201).json({ message: 'Account created successfully', user: newUser.rows[0] });
    } catch (err) {
        console.error('Error during signup:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if the username exists
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Validate the password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign({ user_id: user.user_id }, JWT_SECRET, { expiresIn: '2h' });
        res.json({ message: 'Login successful', token });
    } catch (err) {
        console.error('Error during login:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// PROTECTED ROUTES

// Get all users (protected)
app.get('/users', authenticateToken, async (req, res) => {
    try {
        const users = await pool.query('SELECT * FROM users');
        res.json(users.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// SALES ROUTES 

// Create an order
app.post('/sales', authenticateToken, async (req, res) => {
    try {
        const { user_id, user_name, item_id, order_quantity, order_size, pickup_date_time } = req.body;

        const itemResult = await pool.query('SELECT price FROM inventory WHERE item_id = $1', [item_id]);

        if (itemResult.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const price = itemResult.rows[0].price;
        const order_total = price * order_quantity;

        const newOrder = await pool.query(
            `INSERT INTO sales (user_id, user_name, item_id, order_quantity, order_size, pickup_date_time, status, order_total)
             VALUES ($1, $2, $3, $4, $5, 'not fulfilled', $6)
             RETURNING *`,
            [user_id, user_name, item_id, order_quantity, order_size, pickup_date_time, order_total]
        );

        res.json(newOrder.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/sales', authenticateToken, async (req, res) => {
    try {
        const sales = await pool.query('SELECT * FROM sales');
        res.json(sales.rows);
    } catch (err) {
        console.error(err.message);
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
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Fulfill/unfulfill
app.put('/sales/:id/toggle-fulfillment', authenticateToken, async (req, res) => {
    let { id } = req.params;
    const { staff_signoff } = req.body;

    try {
        console.log(`Processing toggle for sale_id: ${id}`);

        // Convert id to integer
        id = parseInt(id, 10);
        if (isNaN(id)) {
            console.error(`Invalid sale_id parameter: ${req.params.id}`);
            return res.status(400).json({ error: 'Invalid sale_id parameter' });
        }

        // Check if the sale exists
        const result = await pool.query('SELECT status FROM sales WHERE sale_id = $1::INTEGER', [id]);
        console.log('Query result:', result.rows);

        if (result.rows.length === 0) {
            console.error(`Order with sale_id ${id} not found`);
            return res.status(404).json({ error: 'Order not found' });
        }

        const currentStatus = result.rows[0].status;
        console.log(`Current status: ${currentStatus}`);

        // Determine new status
        const newStatus = currentStatus === 'fulfilled' ? 'not fulfilled' : 'fulfilled';
        console.log(`New status: ${newStatus}`);

        // If setting to 'fulfilled', require staff_signoff
        if (newStatus === 'fulfilled') {
            if (!staff_signoff || staff_signoff.trim() === '') {
                return res.status(400).json({ error: 'Staff signoff is required when fulfilling an order' });
            }
        }

        // Update the sale with the new status and staff_signoff
        const updateResult = await pool.query(
            `UPDATE sales
             SET status = $1::VARCHAR,
                 fulfillment_time = CASE WHEN $1 = 'fulfilled' THEN CURRENT_TIMESTAMP ELSE NULL END,
                 staff_signoff = CASE WHEN $1 = 'fulfilled' THEN $3::VARCHAR ELSE NULL END
             WHERE sale_id = $2::INTEGER
             RETURNING *`,
            [newStatus, id, staff_signoff]
        );
        console.log('Update result:', updateResult.rows);

        res.json({ message: 'Order status updated successfully', order: updateResult.rows[0] });
    } catch (err) {
        console.error(`Error toggling fulfillment status for sale_id ${id}:`, err.message);
        console.error(err.stack);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});


// Start the server
app.listen(port, () => console.log(`Server has started on port ${port}`));
