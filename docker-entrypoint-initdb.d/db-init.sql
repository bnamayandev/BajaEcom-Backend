CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- Create the inventory table
CREATE TABLE IF NOT EXISTS inventory (
    item_id SERIAL PRIMARY KEY,
    clothing_type VARCHAR(100) NOT NULL,
    size VARCHAR(10) NOT NULL,
    quantity_available INT NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    item_photo VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL
);

-- Create the orders table
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

-- Create the order_items table
CREATE TABLE IF NOT EXISTS order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(order_id) ON DELETE CASCADE,
    item_id INT REFERENCES inventory(item_id) ON DELETE CASCADE,
    quantity INT NOT NULL,
    size VARCHAR(10) NOT NULL,
    item_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL
);