const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 8080;

const LOG_FILE = path.join(__dirname, "log.json");
app.set("views", __dirname + "/views");
const DATA_FILE = path.join(__dirname, "data.json");

// Express / EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// helpers
async function readData() {
  if (!(await fs.pathExists(DATA_FILE))) {
    await fs.writeJson(DATA_FILE, { students: [] }, { spaces: 2 });
  }
  const obj = await fs.readJson(DATA_FILE);
  return obj.students || [];
}
async function writeData(students) {
  await fs.writeJson(DATA_FILE, { students }, { spaces: 2 });
}

// ✅ LOG SYSTEM
async function readLogs() {
  if (!(await fs.pathExists(LOG_FILE))) {
    await fs.writeJson(LOG_FILE, { logs: [] }, { spaces: 2 });
  }
  const obj = await fs.readJson(LOG_FILE);
  return obj.logs || [];
}
async function writeLogs(logs) {
  await fs.writeJson(LOG_FILE, { logs }, { spaces: 2 });
}
async function addLog(action, student_id, student_name) {
  const logs = await readLogs();
  logs.push({
    id: logs.length + 1,
    student_id,
    student_name,
    action,
    date: new Date().toLocaleString()
  });
  await writeLogs(logs);
}

// Home -> login
app.get("/", (req, res) => res.render("login"));

// List + search
app.get("/students", async (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();
  let students = await readData();

  students = students.map(s =>
    Object.fromEntries(
      Object.entries(s).map(([k, v]) => [k, String(v ?? "").trim()])
    )
  );

  if (q) {
    const tokens = q.split(/\s+/);
    students = students.filter(s =>
      tokens.every(t => {
        if (t.includes(":")) {
          const [f, ...rest] = t.split(":");
          const val = rest.join(":").trim().toLowerCase();
          return (s[f] || "").toLowerCase().includes(val);
        } else {
          return Object.values(s).some(v =>
            v.toLowerCase().includes(t)
          );
        }
      })
    );
  }

  res.render("listStudents", { students, q });
});

// Add student
app.get("/students/add", (req, res) => res.render("addStudent"));
app.post("/students/add", async (req, res) => {
  const students = await readData();
  const newId = "LIB" + (students.length + 1).toString().padStart(3, "0");
  const newStudent = {
    student_id: newId,
    name: req.body.name || "Unnamed",
    roll_no: req.body.roll_no || "",
    course: req.body.course || "",
    year: req.body.year || "1st Year",
    section: req.body.section || "",
    gender: req.body.gender || "",
    dob: req.body.dob || "",
    email: req.body.email || "",
    phone: req.body.phone || "",
    address: req.body.address || "",
    library_card_issued: req.body.library_card_issued === "on" ? true : false,
    library_card_no: req.body.library_card_no || null,
    card_issue_date: req.body.card_issue_date || null,
    card_expiry_date: req.body.card_expiry_date || null,
    books_issued_count: 0,
    last_issued_book: null,
    last_issued_date: null,
    last_return_date: null,
    fine_due: 0,
    fine_paid: 0,
    membership_type: req.body.membership_type || "Regular",
    library_fee_paid: req.body.library_fee_paid === "on" ? true : false,
    library_fee_amount: parseInt(req.body.library_fee_amount || 0),
    fee_payment_date: req.body.fee_payment_date || null,
    total_books_issued_year: 0,
    preferred_genre: req.body.preferred_genre || "",
    reading_hours_per_week: parseInt(req.body.reading_hours_per_week || 0),
    library_visits_per_month: parseInt(req.body.library_visits_per_month || 0),
    remarks: req.body.remarks || "",
    issued_books: []
  };
  students.push(newStudent);
  await writeData(students);
  await addLog("Added new student", newId, newStudent.name);
  res.redirect("/students");
});

// View student
app.get("/students/view/:id", async (req, res) => {
  const students = await readData();
  const student = students.find(s => s.student_id === req.params.id);
  res.render("viewStudent", { student });
});

// Edit student
app.get("/students/edit/:id", async (req, res) => {
  const students = await readData();
  const student = students.find(s => s.student_id === req.params.id);
  res.render("editStudent", { student });
});
app.post("/students/edit/:id", async (req, res) => {
  const students = await readData();
  const idx = students.findIndex(s => s.student_id === req.params.id);
  if (idx !== -1) {
    const s = students[idx];
    const fields = ["name","roll_no","course","year","section","email","phone","address","membership_type","preferred_genre","remarks"];
    fields.forEach(f => { if (req.body[f] !== undefined) s[f] = req.body[f]; });
    s.library_fee_paid = req.body.library_fee_paid === "on";
    s.library_fee_amount = parseInt(req.body.library_fee_amount || s.library_fee_amount || 0);
    await writeData(students);
    await addLog("Edited student details", s.student_id, s.name);
  }
  res.redirect("/students");
});

// Delete student
app.post("/students/delete/:id", async (req, res) => {
  let students = await readData();
  const student = students.find(s => s.student_id === req.params.id);
  if (student) await addLog("Deleted student", student.student_id, student.name);
  students = students.filter(s => s.student_id !== req.params.id);
  await writeData(students);
  res.redirect("/students");
});

// Issue book
app.post("/students/:id/issue", async (req, res) => {
  const students = await readData();
  const s = students.find(x => x.student_id === req.params.id);
  if (s) {
    const book = {
      book_id: req.body.book_id || "BK" + Math.floor(Math.random()*9000+100),
      book_name: req.body.book_name || "Untitled",
      author: req.body.author || "",
      issue_date: new Date().toISOString().slice(0,10),
      return_date: req.body.return_date || null,
      status: "Issued"
    };
    s.issued_books = s.issued_books || [];
    s.issued_books.push(book);
    s.books_issued_count = (s.books_issued_count || 0) + 1;
    s.last_issued_book = book.book_name;
    s.last_issued_date = book.issue_date;
    await writeData(students);
    await addLog(`Issued book: ${book.book_name}`, s.student_id, s.name);
  }
  res.redirect("/students/view/" + req.params.id);
});

// Return book
app.get("/students/:id/return", async (req, res) => {
  const students = await readData();
  const student = students.find(s => s.student_id === req.params.id);
  res.render("return", { student });
});
app.post("/students/:id/return", async (req, res) => {
  const students = await readData();
  const s = students.find(x => x.student_id === req.params.id);
  if (s && s.issued_books) {
    const bookId = req.body.book_id;
    const returnedBook = s.issued_books.find(b => b.book_id === bookId);
    s.issued_books = s.issued_books.filter(b => b.book_id !== bookId);
    s.last_return_date = new Date().toISOString().slice(0, 10);
    await writeData(students);
    if (returnedBook) await addLog(`Returned book: ${returnedBook.book_name}`, s.student_id, s.name);
  }
  res.redirect("/students/view/" + req.params.id);
});

// Library card actions
app.post("/students/:id/card", async (req, res) => {
  const action = req.body.action;
  const students = await readData();
  const s = students.find(x => x.student_id === req.params.id);
  if (s) {
    if (action === "issue") {
      s.library_card_issued = true;
      s.library_card_no = s.library_card_no || ("LIBC" + Math.floor(Math.random()*90000+1000));
      s.card_issue_date = new Date().toISOString().slice(0,10);
      const exp = new Date(); exp.setFullYear(exp.getFullYear()+3);
      s.card_expiry_date = exp.toISOString().slice(0,10);
      await addLog("Library card issued", s.student_id, s.name);
    } else if (action === "renew") {
      const cur = s.card_expiry_date ? new Date(s.card_expiry_date) : new Date();
      cur.setFullYear(cur.getFullYear()+3);
      s.card_expiry_date = cur.toISOString().slice(0,10);
      await addLog("Library card renewed", s.student_id, s.name);
    } else if (action === "cancel") {
      s.library_card_issued = false;
      s.library_card_no = null;
      s.card_issue_date = null;
      s.card_expiry_date = null;
      await addLog("Library card cancelled", s.student_id, s.name);
    }
    await writeData(students);
  }
  res.redirect("/students/view/" + req.params.id);
});



// 🔹 View log for specific student
app.get("/students/:id/log", async (req, res) => {
  const logs = await readLogs();
  const studentId = req.params.id;
  const studentLogs = logs.filter(l => l.student_id === studentId);
  res.render("log", { logs: studentLogs, filter: studentId, q: "" });
});

// 🔹 View all logs (with optional search)

app.get("/log", (req, res) => {
  const logs = [
    {
      transaction_id: "T001",
      student_id: "LIB012",
      student_name: "Akash Raj",
      book_name: "Java Programming",
      date: "2025-10-10",
      status: "Issued"
    },
    {
      transaction_id: "T002",
      student_id: "LIB012",
      student_name: "Akash Raj",
      book_name: "DBMS Concepts",
      date: "2025-10-20",
      status: "Returned"
    }
  ];

  const q = req.query.q; // for search bar
  res.render("log.ejs", { logs, q });
});



app.get("/log", async (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();
  let logs = await readLogs();

  if (q) {
    logs = logs.filter(
      l =>
        l.transaction_id.toLowerCase().includes(q) ||
       l.student_id.toLowerCase().includes(q) ||
        l.student_name.toLowerCase().includes(q) ||
        l.book_name?.toLowerCase().includes(q) ||
         l.date.toLowerCase().includes(q) ||
          l.status.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q)
    );
  }

  res.render("log", { logs, q, filter: null });
});

//  Start Server
app.listen(PORT, () => console.log(` Server running on http://localhost:${PORT}`));

