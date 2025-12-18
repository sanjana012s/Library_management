const express = require("express");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 8080;
const ORDERS_FILE = path.join(__dirname, "orders.json");

// ✅ middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

// ---------------- MENU ----------------
const menu = [
  { id: 1, name: "Paneer Butter Masala", price: 180 },
  { id: 2, name: "Veg Thali", price: 120 },
  { id: 3, name: "Chicken Biryani", price: 240 },
  { id: 4, name: "Dal Makhani", price: 150 },
  { id: 5, name: "Chole Bhature", price: 130 },
  { id: 6, name: "Masala Dosa", price: 100 },
  { id: 7, name: "Gulab Jamun", price: 60 },
  { id: 8, name: "Lassi", price: 50 },
  { id: 9, name: "Naan", price: 40 },
  { id: 10, name: "Rogan Josh", price: 220 },
  { id: 11, name: "Fish Curry", price: 250 },
  { id: 12, name: "Prawn Masala", price: 270 },
  { id: 13, name: "Mutton Korma", price: 300 },
  { id: 14, name: "Veg Pulao", price: 110 },
  { id: 15, name: "Butter Naan", price: 50 },
  { id: 16, name: "Tandoori Chicken", price: 280 },
  { id: 17, name: "Raita", price: 30 },
  { id: 18, name: "Papad", price: 20 },
  { id: 19, name: "Salad", price: 40 },
  { id: 20, name: "Mango Lassi", price: 70 },
  { id: 21, name: "Chicken Tikka", price: 260 },
{ id: 22, name: "Veg Manchurian", price: 140 },
{ id: 23, name: "Spring Rolls", price: 120 },
{ id: 24, name: "Fried Rice", price: 130 },
{ id: 25, name: "Noodles", price: 110 },
{ id: 26, name: "Samosa", price: 40 },
{ id: 27, name: "Jalebi", price: 80 },
{ id: 28, name: "Kulfi", price: 90 },
{ id: 29, name: "Chai", price: 30 },
{ id: 30, name: "Coffee", price: 40 },


];

// ---------------- ORDERS ----------------
let orders = [];

// Load orders
if (fs.existsSync(ORDERS_FILE)) {
  orders = JSON.parse(fs.readFileSync(ORDERS_FILE, "utf-8"));
}

// Save orders
function saveOrders() {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

// ---------------- ROUTES ----------------

// ---------------- HELPERS ----------------
function randomColor() {
  const r = Math.floor(Math.random() * 128 + 127);
  const g = Math.floor(Math.random() * 128 + 127);
  const b = Math.floor(Math.random() * 128 + 127);
  return `rgb(${r},${g},${b})`;
}

// ---------------- ROUTES ----------------
app.get("/", (req, res) => res.redirect("/dashboard"));

app.get("/dashboard", (req, res) => {
  res.render("dashboard", { menu, randomColor });
});

/**
 * ✅ OWNER PANEL
 */
app.get("/owner", (req, res) => {
  res.render("owner", { orders: orders, randomColor }); // <-- yahan orders pass kiya
});


/**
 * ✅ QR GENERATION ROUTE (IMPORTANT)
 * is page ka QR scan karoge → dashboard open hoga
 */
app.get("/qr", async (req, res) => {
  // 🔴 ngrok public URL yahan paste karo
  const PUBLIC_URL = "https://bipetalous-cecilia-overempirical.ngrok-free.dev";

  try {
    const qr = await QRCode.toDataURL(PUBLIC_URL);
    res.send(`
      <h2>📱 Scan QR to View Menu</h2>
      <img src="${qr}" />
      <p>Scan this QR to see all food items</p>
    `);
  } catch (err) {
    res.send("❌ QR generation error");
  }
});




// ---------------- CHECKOUT ----------------
app.post("/checkout", (req, res) => {
  const { customerName, tableNo, items, total } = req.body;
  if (!items) return res.redirect("/dashboard");

  res.render("checkout", {
    customerName,
    tableNo,
    items,
    total
  });
});

// ---------------- PAYMENT SUCCESS ----------------
app.post("/payment-success", (req, res) => {
  const { customerName, tableNo, items } = req.body;

  // ✅ items always array
  const selected = Array.isArray(items) ? items : [items];

  // ✅ map items from menu
  const orderedItems = selected
    .map(id => menu.find(m => m.id == id))
    .filter(Boolean);

  const total = orderedItems.reduce((s, i) => s + i.price, 0);

  const newOrder = {
    id: Date.now(),
    customerName,
    tableNo,
    items: orderedItems,
    total,
    status: "Pending",
    createdAt: Date.now()
  };

  orders.push(newOrder);
  saveOrders();

  io.emit("newOrder", newOrder);

    res.send("Order placed successfully"); // frontend JS alert will show
});

// ---------------- AUTO CLEAN (24h) ----------------
const DAY_24 = 24 * 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  orders = orders.filter(o => now - o.createdAt < DAY_24);
  saveOrders();
}, 60 * 60 * 1000);

// ---------------- SOCKET ----------------
io.on("connection", () => {
  console.log("⚡ Client connected");
});



app.post("/update-status/:id", (req, res) => {
  const orderId = req.params.id;
  const newStatus = req.body.status;

  // orders array ya orders.json me update
  const order = orders.find(o => o.id == orderId);

  if (order) {
    order.status = newStatus;
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
  }

  res.redirect("/owner");
});


// ---------------- START SERVER ----------------
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
