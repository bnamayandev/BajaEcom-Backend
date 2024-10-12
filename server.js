// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const pool = require('./db');
const port = process.env.PORT || 1337; // Fallback to 1337 if PORT is not defined

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.sendStatus(200);
});

app.post('/', (req, res) => {
    const { name, location } = req.body;
    res.status(200).send({
        message: `YOUR KEYS WERE ${name}, ${location}`
    });
});

app.get('/setup', async (req, res) => {
    try {
        await pool.query('CREATE TABLE schools( id SERIAL)')
        res.sendStatus(200); // It's good practice to send a response on success
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
})

app.listen(port, () => console.log(`Server has started on port ${port}`));
