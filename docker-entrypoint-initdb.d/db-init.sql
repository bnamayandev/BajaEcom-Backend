-- Create the users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
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
    itemPhoto VARCHAR(255) NOT NULL
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
    order_total NUMERIC(10, 2) NOT NULL DEFAULT 0
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

-- Insert sample users with hashed passwords
-- Note: Replace the hashed passwords with actual bcrypt hashes of the passwords
INSERT INTO users (username, first_name, last_name, phone_number, password) VALUES
('john_doe', 'John', 'Doe', '123-456-7890', '$2b$10$eBQK0mYj1n1VvN.Cs8yWye3ZdUfa1iCqsnYb6C2xZW6ipI5/0e.jW'), -- password: password123
('jane_smith', 'Jane', 'Smith', '987-654-3210', '$2b$10$4k2.zRfjrAqjKF1b6CQ1XeWOfIIMPGXzj8r1zEBNPafmVlvf5n.5S'), -- password: securepassword
('alice_johnson', 'Alice', 'Johnson', '555-123-4567', '$2b$10$eZx4p/BR3eBV4PCD0dhFGOx3xVb3WgOZxHzlJyF5ps3bEAmhKFOxG'); -- password: alicepass

-- Insert sample inventory items
INSERT INTO inventory (clothing_type, size, quantity_available, price, itemPhoto) VALUES
('Graphic T-Shirt', 'M', 50, 19.99, 'tshirt.jpg'),
('Graphic T-Shirt', 'L', 25, 19.99, 'tshirt.jpg'),
('Baseball Cap', 'L', 15, 9.99, 'cap.jpg'),
('Hoodie', 'XL', 10, 29.99, 'hoodie.jpg');

-- Insert sample orders
INSERT INTO orders (user_id, pickup_date_time, status, order_total) VALUES
(1, '2024-12-15 10:00:00', 'not fulfilled', 69.97),
(2, '2024-12-20 14:00:00', 'not fulfilled', 29.97),
(3, '2024-12-25 09:00:00', 'fulfilled', 59.97);

-- Insert sample order items
INSERT INTO order_items (order_id, item_id, quantity, size, item_price, total_price) VALUES
(1, 1, 2, 'M', 19.99, 39.98),
(1, 3, 1, 'L', 9.99, 9.99),
(1, 2, 1, 'L', 19.99, 19.99),
(2, 3, 3, 'L', 9.99, 29.97),
(3, 2, 3, 'L', 19.99, 59.97);