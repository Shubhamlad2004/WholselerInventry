import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("dairy.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_name TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    base_price REAL NOT NULL,
    stock REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    route_order INTEGER DEFAULT 0,
    balance REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS custom_pricing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS regular_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    delivery_date TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'unpaid',
    total_amount REAL DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS delivery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    price_per_unit REAL NOT NULL,
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// Migrations for existing databases
try {
  db.prepare("ALTER TABLE products ADD COLUMN stock REAL DEFAULT 0").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE customers ADD COLUMN balance REAL DEFAULT 0").run();
} catch (e) {}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  
  // Products
  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products").all();
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { brand_name, type, name, base_price, stock } = req.body;
    const info = db.prepare("INSERT INTO products (brand_name, type, name, base_price, stock) VALUES (?, ?, ?, ?, ?)").run(brand_name, type, name, base_price, stock || 0);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/products/:id/stock", (req, res) => {
    const { stock } = req.body;
    db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(stock, req.params.id);
    res.json({ success: true });
  });

  // Customers
  app.get("/api/customers", (req, res) => {
    const customers = db.prepare("SELECT * FROM customers ORDER BY route_order").all();
    res.json(customers);
  });

  app.post("/api/customers", (req, res) => {
    const { name, address, phone, route_order, custom_pricing, regular_orders, initial_balance } = req.body;
    
    const transaction = db.transaction(() => {
      const customerInfo = db.prepare("INSERT INTO customers (name, address, phone, route_order, balance) VALUES (?, ?, ?, ?, ?)").run(name, address, phone, route_order || 0, initial_balance || 0);
      const customerId = customerInfo.lastInsertRowid;

      if (custom_pricing) {
        const pricingStmt = db.prepare("INSERT INTO custom_pricing (customer_id, product_id, price) VALUES (?, ?, ?)");
        for (const p of custom_pricing) {
          pricingStmt.run(customerId, p.product_id, p.price);
        }
      }

      if (regular_orders) {
        const orderStmt = db.prepare("INSERT INTO regular_orders (customer_id, product_id, quantity) VALUES (?, ?, ?)");
        for (const o of regular_orders) {
          orderStmt.run(customerId, o.product_id, o.quantity);
        }
      }
      return customerId;
    });

    const id = transaction();
    res.json({ id });
  });

  // Deliveries
  app.get("/api/deliveries/today", (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const customers = db.prepare(`
      SELECT c.*, 
      (SELECT id FROM deliveries d WHERE d.customer_id = c.id AND d.delivery_date = ?) as delivery_id,
      (SELECT status FROM deliveries d WHERE d.customer_id = c.id AND d.delivery_date = ?) as delivery_status
      FROM customers c
      ORDER BY c.route_order
    `).all(today, today);
    res.json(customers);
  });

  app.post("/api/deliveries/record", (req, res) => {
    const { customer_id, items } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    const transaction = db.transaction(() => {
      let totalAmount = 0;
      
      // Check if delivery already exists for today
      let delivery = db.prepare("SELECT id, total_amount FROM deliveries WHERE customer_id = ? AND delivery_date = ?").get(customer_id, today);
      let deliveryId;

      if (delivery) {
        deliveryId = delivery.id;
        // We'll update the total later
      } else {
        const deliveryInfo = db.prepare("INSERT INTO deliveries (customer_id, delivery_date, status, payment_status, total_amount) VALUES (?, ?, 'delivered', 'unpaid', 0)").run(customer_id, today);
        deliveryId = deliveryInfo.lastInsertRowid;
      }

      const itemStmt = db.prepare("INSERT INTO delivery_items (delivery_id, product_id, quantity, price_per_unit) VALUES (?, ?, ?, ?)");
      const stockStmt = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
      
      let newItemsTotal = 0;
      for (const item of items) {
        const itemTotal = item.quantity * item.price_per_unit;
        newItemsTotal += itemTotal;
        itemStmt.run(deliveryId, item.product_id, item.quantity, item.price_per_unit);
        stockStmt.run(item.quantity, item.product_id);
      }

      // Update delivery total
      db.prepare("UPDATE deliveries SET total_amount = total_amount + ? WHERE id = ?").run(newItemsTotal, deliveryId);
      
      // Update customer balance
      db.prepare("UPDATE customers SET balance = balance + ? WHERE id = ?").run(newItemsTotal, customer_id);

      return deliveryId;
    });

    const id = transaction();
    res.json({ id });
  });

  // Payments
  app.get("/api/payments/balances", (req, res) => {
    const balances = db.prepare("SELECT * FROM customers WHERE balance != 0 ORDER BY name").all();
    res.json(balances);
  });

  app.post("/api/payments/record", (req, res) => {
    const { customer_id, amount, note } = req.body;
    
    const transaction = db.transaction(() => {
      // Record payment (could add a payments table if needed, for now just update balance)
      db.prepare("UPDATE customers SET balance = balance - ? WHERE id = ?").run(amount, customer_id);
      return { success: true };
    });

    const result = transaction();
    res.json(result);
  });

  // System
  app.post("/api/system/reset-day", (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const transaction = db.transaction(() => {
        // 1. Reset all product stocks to 0
        db.prepare("UPDATE products SET stock = 0").run();
        
        // 2. Clear today's delivery marks (delete today's deliveries)
        // This allows the UI to show customers as 'not delivered' again.
        db.prepare(`
          DELETE FROM delivery_items 
          WHERE delivery_id IN (SELECT id FROM deliveries WHERE delivery_date = ?)
        `).run(today);
        
        db.prepare("DELETE FROM deliveries WHERE delivery_date = ?").run(today);
        
        return { success: true };
      });

      transaction();
      res.json({ success: true, message: "System reset: Stock set to 0 and delivery marks cleared." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to reset day" });
    }
  });

  app.get("/api/system/export-csv", (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const deliveries = db.prepare(`
      SELECT d.*, c.name as customer_name, c.phone as customer_phone
      FROM deliveries d
      JOIN customers c ON d.customer_id = c.id
      WHERE d.delivery_date = ?
    `).all(today);

    const allProducts = db.prepare("SELECT name, stock FROM products").all();

    let csv = "Date,Customer,Total Amount,Items Delivered\n";
    
    deliveries.forEach(d => {
      const items = db.prepare("SELECT di.*, p.name as product_name FROM delivery_items di JOIN products p ON di.product_id = p.id WHERE di.delivery_id = ?").all(d.id);
      const itemsString = items.map(i => `${i.product_name}(${i.quantity})`).join("; ");
      csv += `${today},"${d.customer_name}",${d.total_amount},"${itemsString}"\n`;
    });

    csv += "\nInventory Status (End of Day)\n";
    csv += "Product,Remaining Stock\n";
    allProducts.forEach(p => {
      csv += `"${p.name}",${p.stock}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment(`dairy_report_${today}.csv`);
    res.send(csv);
  });

  // Get customer details including custom pricing and regular orders
  app.get("/api/customers/:id/details", (req, res) => {
    const customerId = req.params.id;
    const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
    const pricing = db.prepare("SELECT cp.*, p.name as product_name FROM custom_pricing cp JOIN products p ON cp.product_id = p.id WHERE cp.customer_id = ?").all(customerId);
    const orders = db.prepare("SELECT ro.*, p.name as product_name, p.base_price FROM regular_orders ro JOIN products p ON ro.product_id = p.id WHERE ro.customer_id = ?").all(customerId);
    
    res.json({ customer, pricing, orders });
  });

  // Get customer delivery history
  app.get("/api/customers/:id/history", (req, res) => {
    const customerId = req.params.id;
    const deliveries = db.prepare(`
      SELECT d.* 
      FROM deliveries d 
      WHERE d.customer_id = ? 
      ORDER BY d.delivery_date DESC
    `).all(customerId);

    const history = deliveries.map(d => {
      const items = db.prepare(`
        SELECT di.*, p.name as product_name 
        FROM delivery_items di 
        JOIN products p ON di.product_id = p.id 
        WHERE di.delivery_id = ?
      `).all(d.id);
      return { ...d, items };
    });

    res.json(history);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
