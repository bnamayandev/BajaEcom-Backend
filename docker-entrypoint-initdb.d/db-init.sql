-- Create the users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- Insert sample users with hashed passwords
INSERT INTO users (username, first_name, last_name, phone_number, password) VALUES
('john_doe', 'John', 'Doe', '123-456-7890', '$2b$10$4mJChz1GZjEnETQOCbg0fOVu4/RPGXey45LwrDt5OWlTC4fdDrJlK'), -- password: password123
('jane_smith', 'Jane', 'Smith', '987-654-3210', '$2b$10$UIrA5UYPgYUd7BR.jFZxsuV1zSy2/9BYQ6EwJMb8poVRQ96M4yCUO'), -- password: securepassword
('alice_johnson', 'Alice', 'Johnson', '555-123-4567', '$2b$10$0NVDAaFBGz/FmP8X.x1HuO3/7YopGywxeSv8mQm9blV07aYmzQhuu'); -- password: alicepass
~

-- Create the inventory table
CREATE TABLE IF NOT EXISTS inventory (
    item_id SERIAL PRIMARY KEY,
    clothing_type VARCHAR(100) NOT NULL,
    size VARCHAR(10) NOT NULL,
    quantity_available INT NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0
);

-- Insert sample inventory items
INSERT INTO inventory (clothing_type, size, quantity_available, price) VALUES
('Graphic T-Shirt', 'M', 50, 19.99),
('Graphic T-Shirt', 'L', 25, 19.99),
('Baseball Cap', 'L', 15, 9.99),
('Hoodie', 'XL', 10, 29.99);

-- Create the sales table
CREATE TABLE IF NOT EXISTS sales (
    sale_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    item_id INT REFERENCES inventory(item_id) ON DELETE CASCADE,
    order_quantity INT NOT NULL,
    order_size VARCHAR(10) NOT NULL,
    order_date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pickup_date_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'not fulfilled',
    fulfillment_time TIMESTAMP NULL,
    staff_signoff VARCHAR(100) NULL,
    order_total NUMERIC(10, 2) NOT NULL DEFAULT 0
);

-- Insert sample sales orders
INSERT INTO sales (user_id, item_id, order_quantity, order_size, pickup_date_time, status, order_total) VALUES
(1, 1, 2, 'M', '2024-12-15 10:00:00', 'not fulfilled', 39.98),
(2, 3, 1, 'L', '2024-12-20 14:00:00', 'not fulfilled', 9.99),
(3, 2, 3, 'L', '2024-12-25 09:00:00', 'fulfilled', 59.97),
(1, 4, 1, 'XL', '2024-12-30 16:00:00', 'not fulfilled', 29.99);
