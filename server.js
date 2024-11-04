// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const bcrypt = require('bcrypt');
const morgan = require('morgan');
const pool = require('./db');
const port = process.env.PORT || 3000; // Fallback to 1337 if PORT is not defined
const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan('combined'));

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

//SALES ROUTES//

// Create an order
app.post('/sales', authenticateToken, async (req, res) => {
    try {
        const { user_id, item_id, order_quantity, order_size, pickup_date_time } = req.body;

        const itemResult = await pool.query(
            'SELECT price FROM inventory WHERE item_id = $1',
            [item_id]
        );

        if (itemResult.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const price = itemResult.rows[0].price;
        const order_total = price * order_quantity;

        const newOrder = await pool.query(
            `INSERT INTO sales (user_id, item_id, order_quantity, order_size, pickup_date_time, status, order_total)
             VALUES ($1, $2, $3, $4, $5, 'not fulfilled', $6)
             RETURNING *`,
            [user_id, item_id, order_quantity, order_size, pickup_date_time, order_total]
        );

        res.json(newOrder.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});



// Get all orders
app.get('/sales', authenticateToken, async (req, res) => {
    try {
        const allSales = await pool.query(`SELECT * FROM SALES`);
        res.json(allSales.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error: ${err.message}' });
    }
});


// Get an order by ID
app.get('/sales/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const order = await pool.query(
            `SELECT * FROM sales WHERE sale_id = $1`,
            [id]
        );
        if (order.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(order.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Fulfill an order (mark as fulfilled)
app.put('/sales/:id/fulfill', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { staff_signoff } = req.body;
        const fulfillment_time = new Date().toISOString();

        const updateOrder = await pool.query(
            `UPDATE sales 
             SET status = 'fulfilled',
                fullfillment_time = $1,
                staff_signoff = $2
             WHERE sale_id = $3 
             RETURNING *`,
            [fulfillment_time, staff_signoff, id]
        );

        if (updateOrder.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(updateOrder.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

//USER ROUTES//

// Get all users
app.get('/users', authenticateToken, async (req, res) => {
    try {
        const users = await pool.query('SELECT * FROM users');
        res.json(users.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create a new user
app.post('/users', async (req, res) => {
    console.log(req.body);
    try {
        const { username, first_name, last_name, phone_number, password } = req.body;

        if (!password) {
            return res.status(400).json({ error: "Password is required" });
        }

        // Hashing the password
        const saltRounds = 10;
        const hashed_password = await bcrypt.hash(password, saltRounds);

        // Insert user into the database
        const newUser = await pool.query(
            `INSERT INTO users (username, first_name, last_name, phone_number, password) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [username, first_name, last_name, phone_number, hashed_password]
        );
        res.json(newUser.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// User login
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Select user by username
        const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

        if (user.rows.length == 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Log the retrieved user data
        console.log('User found:', user.rows[0]);

        // Log the hashed password
        console.log('Hashed Password:', user.rows[0].password);

        // Compare the hashed password with the user's input
        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        console.log('Password valid:', validPassword);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Log the JWT_SECRET to ensure it's correctly defined
        console.log('JWT_SECRET:', process.env.JWT_SECRET);

        // Generate a jwt
        const token = jwt.sign({ user_id: user.rows[0].user_id }, process.env.JWT_SECRET, {
            expiresIn: '100h',
        });

        // Log the generated token
        console.log('Generated token:', token);

        res.json({ message: 'Login successful', token });

    } catch (err) {
        console.error('Error during login:', err.message);
        console.error(err.stack);   // Log the full stack trace for more details
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Delete a user by ID
app.delete('/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const deleteUser = await pool.query(
            `DELETE FROM users WHERE user_id = $1 RETURNING *`,
            [id]
        );
        if (deleteUser.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(deleteUser.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});


//INVENTORY ROUTES//

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

// Add new product to inventory
app.post('/inventory', authenticateToken, async (req, res) => {
    try {
        const { clothing_type, size, quantity_available } = req.body;
        const newProduct = await pool.query(
            `INSERT INTO inventory (clothing_type, size, quantity_available) 
             VALUES ($1, $2, $3) 
             RETURNING *`,
            [clothing_type, size, quantity_available]
        );
        res.json(newProduct.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete inventory item by ID
app.delete('/inventory/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const deleteInventory = await pool.query(
            `DELETE FROM inventory WHERE item_id = $1 RETURNING *`,
            [id]
        );
        if (deleteInventory.rows.length === 0) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        res.json(deleteInventory.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});


app.listen(port, () => console.log(`Server has started on port ${port}`));