// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const bcrypt = require('bcrypt');
const morgan = require('morgan');
const pool = require('./db');
const port = process.env.PORT || 1337; // Fallback to 1337 if PORT is not defined
const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan('combined'));

//SALES ROUTES//

// Create an order
app.post('/sales', async (req, res) => {
    try {
        const { user_id, item_id, order_quantity, order_size, pickup_date_time, pickup_location } = req.body;
        const newOrder = await pool.query(
            `INSERT INTO sales (user_id, item_id, order_quantity, order_size, pickup_date_time, pickup_location, status) 
             VALUES ($1, $2, $3, $4, $5, $6, 'not fulfilled') 
             RETURNING *`,
            [user_id, item_id, order_quantity, order_size, pickup_date_time, pickup_location]
        );
        res.json(newOrder.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get an order by ID
app.get('/sales/:id', async (req, res) => {
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
app.put('/sales/:id/fulfill', async (req, res) => {
    try {
        const { id } = req.params;
        const { staff_signoff } = req.body;
        const fulfillment_time = new Date().toISOString();

        const updateOrder = await pool.query(
            `UPDATE sales 
             SET status = 'fulfilled',
                fullfillment_time = $1,
                staff_signoff = $2,
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
app.get('/users', async (req, res) => {
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
    try {
        const { username, first_name, last_name, phone_number, password } = req.body;

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

        // compare has password with the user's input
        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        res.json({ message: 'Login successful' });
    } catch (err) {
        console.log(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});
// Delete a user by ID
app.delete('/users/:id', async (req, res) => {
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
app.get('/inventory', async (req, res) => {
    try {
        const inventory = await pool.query('SELECT * FROM inventory');
        res.json(inventory.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add new product to inventory
app.post('/inventory', async (req, res) => {
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
app.delete('/inventory/:id', async (req, res) => {
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
