-- Create the database
CREATE DATABASE bajaecomdb;

-- Connect to the database
\c bajaecomdb;

-- Create the users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,                     -- Auto-incrementing primary key
    username VARCHAR(50) UNIQUE NOT NULL,           -- Unique username
    first_name VARCHAR(50) NOT NULL,                -- First name
    last_name VARCHAR(50) NOT NULL,                 -- Last name
    phone_number VARCHAR(20) NOT NULL,              -- Phone number
    password VARCHAR(255) NOT NULL                  -- Password (hashed)
);

-- Create the inventory table
CREATE TABLE IF NOT EXISTS inventory (
    item_id SERIAL PRIMARY KEY,                     -- Auto-incrementing primary key
    clothing_type VARCHAR(100) NOT NULL,            -- Type of clothing (e.g., 'jacket', 'graphic tshirt')
    size VARCHAR(10) NOT NULL,                      -- Size (e.g., 'S', 'M', 'L', 'XL')
    quantity_available INT NOT NULL                 -- Available quantity for that item and size
);

-- Create the sales table
CREATE TABLE IF NOT EXISTS sales (
    sale_id SERIAL PRIMARY KEY,                     -- Auto-incrementing primary key
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE, -- Foreign key to the users table
    item_id INT REFERENCES inventory(item_id) ON DELETE CASCADE, -- Foreign key to the inventory table
    order_quantity INT NOT NULL,                    -- Quantity ordered
    order_size VARCHAR(10) NOT NULL,                -- Size ordered (should match the size in inventory)
    order_date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Time when the order was placed
    pickup_date_time TIMESTAMP NOT NULL,            -- Scheduled time for the customer to pick up the order
    pickup_location VARCHAR(100) NOT NULL,          -- Pickup location (e.g., store location)
    status VARCHAR(20) NOT NULL DEFAULT 'not fulfilled', -- Status of the order ('fulfilled' or 'not fulfilled')
    fulfillment_time TIMESTAMP NULL,                -- Time when the order was fulfilled (if applicable)
    staff_signoff VARCHAR(100) NULL                 -- Name of the staff member who fulfilled the order (if applicable)
);