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

INSERT INTO inventory (clothing_type, size, quantity_available, price, item_photo, description) VALUES
('Shop Shirt', 'S', 4, 25.00, 'shirt.png', ''),
('Shop Shirt', 'M', 14, 25.00, 'shirt.png', ''),
('Shop Shirt', 'L', 10, 25.00, 'shirt.png', ''),
('Shop Shirt', 'XL', 4, 25.00, 'shirt.png', ''),
('Polo', 'S', 4, 30.00, 'polo.png', ''),
('Polo', 'M', 10, 30.00, 'polo.png', ''),
('Polo', 'L', 10, 30.00, 'polo.png', ''),
('Polo', 'XL', 5, 30.00, 'polo.png', ''),
('Hoodie', 'XL', 0, 40.00, 'hoodie.png', ''),
('Hoodie', 'L', 0, 40.00, 'hoodie.png', ''),
('Hoodie', 'M', 0, 40.00, 'hoodie.png', ''),
('Hoodie', 'S', 0, 40.00, 'hoodie.png', ''),
('Pom-Pom Hat', 'O/S', 19, 25.00, 'pompom.png', ''),
('FlexFit Trucker Hat', 'O/S', 9, 25.00, 'flexfithat.png', ''),
('Snap-Back Trucker Hat', 'O/S', 10, 20.00, 'snapback.png', ''),
('Classic Beanie', 'O/S', 20, 15.00, 'beanie.png', ''),
('Bottle Opener', 'O/S', 100, 5.00, 'bottleopener.png', ''),
('Patch', 'O/S', 100, 5.00, 'patch.png', ''),
('Sticker', 'O/S', 100, 2.00, 'sticker.png', ''),
('Lanyard', 'O/S', 20, 5.00, 'lanyard.png', '');