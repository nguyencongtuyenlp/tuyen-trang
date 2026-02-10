const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Data Directory ---
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
['photos', 'music', 'covers', 'avatars', 'backgrounds'].forEach(dir => {
    fs.mkdirSync(path.join(UPLOADS_DIR, dir), { recursive: true });
});
fs.mkdirSync(DATA_DIR, { recursive: true });

// --- JSON File Storage ---
function readJSON(file) {
    const p = path.join(DATA_DIR, file);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}
function writeJSON(file, data) {
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// Init defaults
if (!readJSON('settings.json')) {
    writeJSON('settings.json', {
        coupleName: 'Tuyền & Trang',
        anniversaryDate: '2024-12-04',
        backgroundType: 'gradient',
        gradientColor1: '#FF6B9D',
        gradientColor2: '#C06C84',
        backgroundUrl: '',
        avatar1Url: '',
        avatar2Url: '',
        enableHearts: true,
        enableParticles: true,
        enableGradient: true,
        enableParallax: true,
        animationIntensity: 5,
        themeColor: '#FF6B9D'
    });
}
if (!readJSON('photos.json')) writeJSON('photos.json', []);
if (!readJSON('music.json')) writeJSON('music.json', []);

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files with correct MIME types
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filepath) => {
        if (filepath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filepath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));
app.use('/uploads', express.static(UPLOADS_DIR));

// --- Multer Config ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let folder = 'photos';
        if (file.fieldname === 'music' || file.fieldname === 'audio') folder = 'music';
        else if (file.fieldname === 'cover') folder = 'covers';
        else if (file.fieldname === 'avatar') folder = 'avatars';
        else if (file.fieldname === 'background') folder = 'backgrounds';
        else if (file.fieldname === 'photo') folder = 'photos';
        cb(null, path.join(UPLOADS_DIR, folder));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, uuidv4() + ext);
    }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

// ==================== API ROUTES ====================

// --- Settings ---
app.get('/api/settings', (req, res) => {
    res.json(readJSON('settings.json'));
});

app.put('/api/settings', (req, res) => {
    const current = readJSON('settings.json');
    const updated = { ...current, ...req.body };
    writeJSON('settings.json', updated);
    res.json(updated);
});

app.post('/api/settings/avatar', upload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const settings = readJSON('settings.json');
    const which = req.body.which || '1'; // '1' or '2'
    const url = `/uploads/avatars/${req.file.filename}`;
    if (which === '2') settings.avatar2Url = url;
    else settings.avatar1Url = url;
    writeJSON('settings.json', settings);
    res.json(settings);
});

app.post('/api/settings/background', upload.single('background'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const settings = readJSON('settings.json');
    settings.backgroundType = 'image';
    settings.backgroundUrl = `/uploads/backgrounds/${req.file.filename}`;
    writeJSON('settings.json', settings);
    res.json(settings);
});

// --- Photos ---
app.get('/api/photos', (req, res) => {
    res.json(readJSON('photos.json'));
});

app.post('/api/photos', upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const photos = readJSON('photos.json');
    const photo = {
        id: uuidv4(),
        url: `/uploads/photos/${req.file.filename}`,
        caption: req.body.caption || '',
        photoDate: req.body.photoDate || new Date().toISOString(),
        createdAt: new Date().toISOString()
    };
    photos.push(photo);
    writeJSON('photos.json', photos);
    res.status(201).json(photo);
});

app.delete('/api/photos/:id', (req, res) => {
    let photos = readJSON('photos.json');
    const photo = photos.find(p => p.id === req.params.id);
    if (photo) {
        // Delete file
        const filePath = path.join(__dirname, photo.url);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    photos = photos.filter(p => p.id !== req.params.id);
    writeJSON('photos.json', photos);
    res.json({ ok: true });
});

// --- Music ---
app.get('/api/music', (req, res) => {
    let songs = readJSON('music.json');
    if (req.query.owner) {
        songs = songs.filter(s => s.owner === req.query.owner);
    }
    res.json(songs);
});

app.post('/api/music', upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
]), (req, res) => {
    const songs = readJSON('music.json');
    const files = req.files || {};
    const audioFile = files.audio?.[0];
    const coverFile = files.cover?.[0];

    const song = {
        id: uuidv4(),
        title: req.body.title || 'Untitled',
        artist: req.body.artist || '',
        owner: req.body.owner || 'tuyen',
        url: req.body.url || '',
        fileUrl: audioFile ? `/uploads/music/${audioFile.filename}` : '',
        coverArtUrl: coverFile ? `/uploads/covers/${coverFile.filename}` : '',
        createdAt: new Date().toISOString()
    };
    songs.push(song);
    writeJSON('music.json', songs);
    res.status(201).json(song);
});

app.delete('/api/music/:id', (req, res) => {
    let songs = readJSON('music.json');
    const song = songs.find(s => s.id === req.params.id);
    if (song) {
        if (song.fileUrl) {
            const fp = path.join(__dirname, song.fileUrl);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
        if (song.coverArtUrl) {
            const fp = path.join(__dirname, song.coverArtUrl);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
    }
    songs = songs.filter(s => s.id !== req.params.id);
    writeJSON('music.json', songs);
    res.json({ ok: true });
});

// --- Stats ---
app.get('/api/stats', (req, res) => {
    const photos = readJSON('photos.json');
    const music = readJSON('music.json');
    const settings = readJSON('settings.json');
    const start = new Date(settings.anniversaryDate);
    const now = new Date();
    const diffMs = now - start;
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor(diffMs / 3600000);
    res.json({ photoCount: photos.length, songCount: music.length, days, hours });
});

// --- Catch-all for SPA ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n  💕 Ngày Yêu Thương đang chạy tại:`);
    console.log(`  👉 http://localhost:${PORT}\n`);
});
