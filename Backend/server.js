const express = require('express');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;


let ExcelJS = null;
try {
  ExcelJS = require('exceljs');
} catch (err) {
  console.warn('Hinweis: "exceljs" nicht installiert. /export.xlsx wird deaktiviert. Zum Aktivieren: npm install exceljs');
}

const app = express();
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'registrations.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(ROOT_DIR)); // liefert index.html, styles.css, script.js

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'meinpass';

function adminAuth(req, res, next) {
  console.log('adminAuth prüfen, auth header =', req.headers.authorization);
  const auth = req.headers.authorization;
  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Bereich"');
    return res.status(401).send('Unauthorized');
  }
  const m = auth.match(/^Basic (.+)$/);
  if (!m) {
    console.log('auth-Header Format ungültig:', auth);
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Bereich"');
    return res.status(401).send('Unauthorized');
  }
  const [user, pass] = Buffer.from(m[1], 'base64').toString().split(':');
  console.log('Versuchter Login:', user);
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  console.log('Login fehlgeschlagen für Benutzer:', user);
  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Bereich"');
  return res.status(401).send('Unauthorized');
}

app.post('/register', (req, res) => {
  const entry = { ...req.body, timestamp: new Date().toISOString() };
  try {
    let list = [];
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8') || '[]';
      list = JSON.parse(raw);
    }
    list.push(entry);
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
    console.log('Eintrag gespeichert:', entry);
    res.json({ success: true });
  } catch (err) {
    console.error('Speichern fehlgeschlagen:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'admin.html'));
});

app.get('/registrations.json', adminAuth, (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json([]);
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8') || '[]';
    const list = JSON.parse(raw);
    res.json(list);
  } catch (err) {
    console.error('Lesen registrations.json fehlgeschlagen:', err);
    res.status(500).json({ error: 'Lesefehler' });
  }
});

app.get('/export.csv', adminAuth, (req, res) => {
  const sortField = req.query.sort || 'nachname';
  const order = req.query.order === 'desc' ? -1 : 1;
  let list = [];
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8') || '[]';
    list = JSON.parse(raw);
  }
  list.sort((a, b) => (a[sortField]||'').toString().localeCompare((b[sortField]||'').toString(), 'de') * order);
  const headers = ['Vorname','Nachname','Schule','Schulform','Klasse','Timestamp'];
  const esc = v => {
    if (v===undefined||v===null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const rows = list.map(i => [i.vorname,i.nachname,i.schule,i.schulform,i.klasse,i.timestamp].map(esc).join(','));
  const csv = [headers.join(','), ...rows].join('\r\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="registrations.csv"');
  res.send('\ufeff'+csv);
});

app.get('/export.xlsx', adminAuth, async (req, res) => {
  if (!ExcelJS) return res.status(500).send('exceljs nicht installiert. Führe "npm install exceljs" aus.');
  const sortField = req.query.sort || 'nachname';
  const order = req.query.order === 'desc' ? -1 : 1;
  let list = [];
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8') || '[]';
    list = JSON.parse(raw);
  }
  list.sort((a, b) => (a[sortField]||'').toString().localeCompare((b[sortField]||'').toString(), 'de') * order);
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Registrierungen');
    sheet.columns = [
      { header: 'Vorname', key: 'vorname', width: 20 },
      { header: 'Nachname', key: 'nachname', width: 20 },
      { header: 'Schule', key: 'schule', width: 30 },
      { header: 'Schulform', key: 'schulform', width: 10 },
      { header: 'Klasse', key: 'klasse', width: 10 },
      { header: 'Timestamp', key: 'timestamp', width: 25 }
    ];
    list.forEach(item => sheet.addRow(item));
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="registrations.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('XLSX Export fehlgeschlagen:', err);
    res.status(500).send('Export fehlgeschlagen');
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft: http://localhost:${PORT}`);
});

