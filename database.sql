-- Create the database
CREATE DATABASE bajaecomdb;

-- Connect to the database
\c bajaecomdb;

-- Create users table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(50) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20) NOT NULL
);

-- Create inventory table
CREATE TABLE inventory (
    item_id SERIAL PRIMARY KEY,
    clothing_type VARCHAR(100) NOT NULL,  -- e.g., 'jacket', 'graphic tshirt', 'blank tshirt'
    size VARCHAR(10) NOT NULL,            -- e.g., 'S', 'M', 'L', 'XL'
    quantity_available INT NOT NULL
);

-- Create sales table
CREATE TABLE sales (
    sale_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    item_id INT REFERENCES inventory(item_id) ON DELETE CASCADE,
    order_quantity INT NOT NULL,
    order_size VARCHAR(10) NOT NULL,
    order_date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pickup_date_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'not fulfilled',  -- 'fulfilled' or 'not fulfilled'
    fulfillment_time TIMESTAMP NULL  -- Only filled when the order is fulfilled
);