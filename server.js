// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const port = process.env.PORT || 1337; // Fallback to 1337 if PORT is not defined
const app = express();

app.use(cors());
app.use(express.json());

//SALES ROUTES//

// create an order

// get an order

// fulfill an order

//

app.listen(port, () => console.log(`Server has started on port ${port}`));
