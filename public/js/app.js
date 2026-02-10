// ==================== STATE ====================
let settings = {};
let photos = [];
let allSongs = [];
let currentTab = 'tuyen';
let uploadMode = 'file';
let selectedOwner = 'tuyen';

// Player state
let audio = null;
let currentSong = null;
let currentPlaylist = [];
let currentSongIndex = 0;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0; // 0=off, 1=all, 2=one
let playerAnimFrame = null;
let audioCtx = null;
let analyser = null;
let audioSource = null;

// Photo Viewer state
let viewerIndex = 0;
let slideshowInterval = null;

// Animation state
let heartsCtx, particlesCtx;
let hearts = [], particles = [];
let animFrame;

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
    audio = document.getElementById('audio-element');
    audio.addEventListener('timeupdate', updatePlayerProgress);
    audio.addEventListener('ended', onSongEnd);
    audio.addEventListener('loadedmetadata', () => {
        document.getElementById('player-duration').textContent = formatTime(audio.duration);
        document.getElementById('player-seek').max = Math.floor(audio.duration);
    });

    document.getElementById('player-seek').addEventListener('input', (e) => {
        audio.currentTime = e.target.value;
    });

    // Load data
    await loadAll();

    // Init animations
    initAnimations();

    // Parallax scroll
    const homeScroll = document.getElementById('home-scroll');
    homeScroll.addEventListener('scroll', handleParallax);

    // Start countdown timer
    setInterval(updateCountdown, 1000);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (document.getElementById('photo-viewer').style.display !== 'none') closePhotoViewer();
            else if (document.getElementById('player-view').style.display !== 'none') closePlayer();
        }
        if (e.key === 'ArrowLeft') prevPhoto();
        if (e.key === 'ArrowRight') nextPhoto();
        if (e.key === ' ' && currentSong) { e.preventDefault(); playerToggle(); }
    });
});

async function loadAll() {
    try {
        [settings, photos, allSongs] = await Promise.all([
            api('/api/settings'),
            api('/api/photos'),
            api('/api/music')
        ]);
    } catch (e) {
        console.error('Load error:', e);
        settings = {};
        photos = [];
        allSongs = [];
    }
    applySettings();
    renderHome();
    renderGallery();
    renderPlaylist();
}

// ==================== API ====================
async function api(url, options = {}) {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

// ==================== SETTINGS ====================
function applySettings() {
    const s = settings;

    // Theme color
    if (s.themeColor) {
        document.documentElement.style.setProperty('--primary', s.themeColor);
    }

    // Couple name
    document.getElementById('couple-name').textContent = s.coupleName || 'Tuyên & Trang';

    // Avatars
    setAvatarDisplay('avatar1', s.avatar1Url, (s.coupleName || 'T&T').charAt(0));
    const name2Initial = (s.coupleName || 'T&T').split('&')[1]?.trim().charAt(0) || 'T';
    setAvatarDisplay('avatar2', s.avatar2Url, name2Initial);
    setAvatarDisplay('settings-avatar1', s.avatar1Url, (s.coupleName || 'T').charAt(0));
    setAvatarDisplay('settings-avatar2', s.avatar2Url, name2Initial);

    // Background
    const gradBg = document.getElementById('gradient-bg');
    const imgBg = document.getElementById('bg-image');
    if (s.backgroundType === 'image' && s.backgroundUrl) {
        imgBg.style.backgroundImage = `url(${s.backgroundUrl})`;
        imgBg.style.display = 'block';
        gradBg.style.opacity = '0.3';
    } else {
        imgBg.style.display = 'none';
        gradBg.style.opacity = '1';
        document.documentElement.style.setProperty('--bg1', s.gradientColor1 || '#FF6B9D');
        document.documentElement.style.setProperty('--bg2', s.gradientColor2 || '#C06C84');
    }

    // Gradient animation
    if (s.enableGradient === false) {
        gradBg.style.animation = 'none';
    } else {
        const speed = 12 - (s.animationIntensity || 5);
        gradBg.style.animation = `gradientShift ${speed}s ease-in-out infinite`;
    }

    // Settings form
    document.getElementById('settings-name').value = s.coupleName || '';
    document.getElementById('settings-date').value = s.anniversaryDate || '';
    document.getElementById('settings-color1').value = s.gradientColor1 || '#FF6B9D';
    document.getElementById('settings-color2').value = s.gradientColor2 || '#C06C84';
    document.getElementById('settings-theme').value = s.themeColor || '#FF6B9D';
    document.getElementById('settings-intensity').value = s.animationIntensity || 5;
    document.getElementById('intensity-val').textContent = s.animationIntensity || 5;
    document.getElementById('enable-hearts').checked = s.enableHearts !== false;
    document.getElementById('enable-particles').checked = s.enableParticles !== false;
    document.getElementById('enable-gradient').checked = s.enableGradient !== false;
    document.getElementById('enable-parallax').checked = s.enableParallax !== false;

    // BG type toggle
    if (s.backgroundType === 'image') {
        document.getElementById('bg-image-btn').classList.add('active');
        document.getElementById('bg-gradient-btn').classList.remove('active');
        document.getElementById('gradient-options').style.display = 'none';
        document.getElementById('image-options').style.display = 'block';
    } else {
        document.getElementById('bg-gradient-btn').classList.add('active');
        document.getElementById('bg-image-btn').classList.remove('active');
        document.getElementById('gradient-options').style.display = 'block';
        document.getElementById('image-options').style.display = 'none';
    }

    updateCountdown();
}

function setAvatarDisplay(id, url, initial) {
    const el = document.getElementById(id);
    if (!el) return;
    if (url) {
        el.innerHTML = `<img src="${url}" alt="">`;
    } else {
        el.innerHTML = `<span class="avatar-initial">${initial || 'T'}</span>`;
    }
}

// ==================== COUNTDOWN ====================
function updateCountdown() {
    const start = new Date(settings.anniversaryDate || '2024-01-01');
    const now = new Date();
    const diff = now - start;

    const totalDays = Math.floor(diff / 86400000);
    const totalHours = Math.floor(diff / 3600000);

    // Detailed breakdown
    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    let days = now.getDate() - start.getDate();
    if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (months < 0) { years--; months += 12; }
    const hours = now.getHours();

    document.getElementById('days-big').textContent = totalDays.toLocaleString();
    document.getElementById('detail-years').textContent = years;
    document.getElementById('detail-months').textContent = months;
    document.getElementById('detail-days').textContent = days;
    document.getElementById('detail-hours').textContent = hours;

    // Stats
    document.getElementById('stat-hours').textContent = totalHours.toLocaleString();
    document.getElementById('stat-photos').textContent = photos.length;
    document.getElementById('stat-songs').textContent = allSongs.length;
    document.getElementById('stat-anniversaries').textContent = years;
}

// ==================== RENDER HOME ====================
function renderHome() {
    renderPhotoCarousel();
    renderMusicCarousel('tuyen');
    renderMusicCarousel('trang');
}

function renderPhotoCarousel() {
    const container = document.getElementById('photo-carousel');
    if (photos.length === 0) {
        container.innerHTML = '<div class="carousel-empty">Chưa có ảnh nào. Thêm ảnh trong Gallery! 📸</div>';
        return;
    }
    container.innerHTML = photos.slice(-10).map((p, i) => `
    <div class="photo-card" onclick="openPhotoViewer(${photos.indexOf(p)})">
      <img src="${p.url}" alt="${p.caption}" loading="lazy">
      ${p.caption ? `<div class="photo-caption">${p.caption}</div>` : ''}
    </div>
  `).join('');
}

function renderMusicCarousel(owner) {
    const container = document.getElementById(`music-carousel-${owner}`);
    const songs = allSongs.filter(s => s.owner === owner);
    if (songs.length === 0) {
        container.innerHTML = '<div class="carousel-empty">Chưa có bài hát nào. 🎵</div>';
        return;
    }
    container.innerHTML = songs.map((s, i) => `
    <div class="song-card" onclick='playSong(${JSON.stringify(s).replace(/'/g, "&#39;")})'>
      <div class="song-card-cover">
        ${s.coverArtUrl ? `<img src="${s.coverArtUrl}" alt="">` : '🎵'}
      </div>
      <div class="song-card-title">${s.title}</div>
      <div class="song-card-artist">${s.artist || ''}</div>
    </div>
  `).join('');
}

// ==================== GALLERY ====================
function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    if (photos.length === 0) {
        grid.innerHTML = '<div class="carousel-empty" style="grid-column:1/-1;padding:60px;">Chưa có ảnh nào. Bấm + để thêm! 📸</div>';
        return;
    }
    grid.innerHTML = photos.map((p, i) => `
    <div class="gallery-item">
      <img src="${p.url}" alt="${p.caption}" loading="lazy" onclick="openPhotoViewer(${i})">
      <button class="delete-photo" onclick="event.stopPropagation(); deletePhoto('${p.id}')">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
}

// ==================== PHOTO VIEWER ====================
function openPhotoViewer(index) {
    viewerIndex = index;
    showViewerPhoto();
    document.getElementById('photo-viewer').style.display = 'flex';
}

function closePhotoViewer() {
    document.getElementById('photo-viewer').style.display = 'none';
    stopSlideshow();
}

function showViewerPhoto() {
    const photo = photos[viewerIndex];
    if (!photo) return;
    document.getElementById('viewer-image').src = photo.url;
    document.getElementById('viewer-counter').textContent = `${viewerIndex + 1} / ${photos.length}`;
    const caption = photo.caption || '';
    const date = photo.photoDate ? new Date(photo.photoDate).toLocaleDateString('vi-VN') : '';
    document.getElementById('viewer-caption').textContent = [caption, date].filter(Boolean).join(' • ');
}

function prevPhoto() {
    if (viewerIndex > 0) { viewerIndex--; showViewerPhoto(); }
}
function nextPhoto() {
    if (viewerIndex < photos.length - 1) { viewerIndex++; showViewerPhoto(); }
}

function toggleSlideshow() {
    const btn = document.getElementById('slideshow-btn');
    if (slideshowInterval) {
        stopSlideshow();
    } else {
        slideshowInterval = setInterval(() => {
            viewerIndex = (viewerIndex + 1) % photos.length;
            showViewerPhoto();
        }, 3000);
        btn.innerHTML = '<i class="fas fa-pause"></i>';
    }
}
function stopSlideshow() {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
    document.getElementById('slideshow-btn').innerHTML = '<i class="fas fa-play"></i>';
}

function deleteCurrentPhoto() {
    if (photos[viewerIndex] && confirm('Xóa ảnh này?')) {
        deletePhoto(photos[viewerIndex].id);
        if (viewerIndex >= photos.length) viewerIndex = photos.length - 1;
        if (photos.length === 0) closePhotoViewer();
        else showViewerPhoto();
    }
}

// ===== Photo touch zoom =====
let viewerScale = 1;
document.addEventListener('DOMContentLoaded', () => {
    const img = document.getElementById('viewer-image');
    if (img) {
        img.addEventListener('dblclick', () => {
            viewerScale = viewerScale > 1 ? 1 : 2.5;
            img.style.transform = `scale(${viewerScale})`;
        });
    }
});

// ==================== PLAYLIST ====================
function renderPlaylist() {
    const songs = allSongs.filter(s => s.owner === currentTab);
    const list = document.getElementById('song-list');
    if (songs.length === 0) {
        list.innerHTML = '<div class="carousel-empty" style="padding:60px;">Chưa có bài hát nào. Bấm + để thêm! 🎵</div>';
        return;
    }
    list.innerHTML = songs.map(s => `
    <div class="song-item" onclick='playSong(${JSON.stringify(s).replace(/'/g, "&#39;")})'>
      <div class="song-thumb">
        ${s.coverArtUrl ? `<img src="${s.coverArtUrl}" alt="">` : '🎵'}
      </div>
      <div class="song-meta">
        <h4>${s.title}</h4>
        <p>${s.artist || 'Unknown'} ${s.url && !s.fileUrl ? '<i class="fas fa-external-link-alt song-link-icon"></i>' : ''}</p>
      </div>
      <div class="song-actions">
        <button class="song-action-btn" onclick="event.stopPropagation(); deleteSong('${s.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function switchMusicTab(owner) {
    currentTab = owner;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick*="${owner}"]`).classList.add('active');
    renderPlaylist();
}

// ==================== MEDIA SESSION API (iPhone Lock Screen) ====================
function updateMediaSession() {
    if ('mediaSession' in navigator && currentSong) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentSong.title || 'Untitled',
            artist: currentSong.artist || 'Unknown Artist',
            album: 'Ngày Yêu Thương',
            artwork: [
                {
                    src: currentSong.coverArtUrl || '/default-cover.png',
                    sizes: '512x512',
                    type: 'image/jpeg'
                }
            ]
        });

        // Set action handlers for lock screen controls
        navigator.mediaSession.setActionHandler('play', () => {
            audio.play();
            isPlaying = true;
            updatePlayerUI();
        });

        navigator.mediaSession.setActionHandler('pause', () => {
            audio.pause();
            isPlaying = false;
            updatePlayerUI();
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
            playerPrev();
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
            playerNext();
        });

        // Update playback state
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
}

// ==================== MUSIC PLAYER ====================
function playSong(song) {
    // If external link only (no file), open in browser
    if (!song.fileUrl && song.url) {
        window.open(song.url, '_blank');
        return;
    }
    if (!song.fileUrl) return;

    currentSong = song;
    currentPlaylist = allSongs.filter(s => s.owner === song.owner && s.fileUrl);
    currentSongIndex = currentPlaylist.findIndex(s => s.id === song.id);

    // Set audio source
    audio.src = song.fileUrl;
    audio.play();
    isPlaying = true;

    // Init Web Audio API analyser (once)
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        audioSource = audioCtx.createMediaElementSource(audio);
        audioSource.connect(analyser);
        analyser.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // Update Media Session for iPhone lock screen controls
    updateMediaSession();

    // Update player UI
    updatePlayerUI();

    // Extract colors from cover & start audio-reactive background
    if (song.coverArtUrl) {
        extractColorsFromImage(song.coverArtUrl).then(colors => {
            startPlayerAnimation(colors);
        });
    } else {
        startPlayerAnimation(['#1a1a2e', '#2d1b4e', '#0f0f23', '#1a0a2e']);
    }

    // Show mini player
    document.getElementById('mini-player').style.display = 'flex';
    updateMiniPlayer();
}

function updatePlayerUI() {
    const s = currentSong;
    document.getElementById('player-title').textContent = s.title;
    document.getElementById('player-artist').textContent = s.artist || 'Unknown';
    const coverImg = document.getElementById('player-cover');
    if (s.coverArtUrl) {
        coverImg.src = s.coverArtUrl;
    } else {
        coverImg.src = '';
        coverImg.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
    }
    document.getElementById('play-btn').innerHTML = '<i class="fas fa-pause"></i>';
}

function updateMiniPlayer() {
    const s = currentSong;
    document.getElementById('mini-title').textContent = s.title;
    document.getElementById('mini-artist').textContent = s.artist || '';
    const cover = document.getElementById('mini-cover');
    if (s.coverArtUrl) {
        cover.src = s.coverArtUrl;
    } else {
        cover.src = '';
    }
    document.getElementById('mini-play-btn').innerHTML =
        isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
}

function playerToggle() {
    if (!currentSong) return;
    if (isPlaying) {
        audio.pause();
    } else {
        audio.play();
    }
    isPlaying = !isPlaying;
    document.getElementById('play-btn').innerHTML =
        isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    updateMiniPlayer();
    updateMediaSession(); // Sync media session state
}

function playerNext() {
    if (currentPlaylist.length === 0) return;
    if (isShuffle) {
        currentSongIndex = Math.floor(Math.random() * currentPlaylist.length);
    } else {
        currentSongIndex = (currentSongIndex + 1) % currentPlaylist.length;
    }
    playSong(currentPlaylist[currentSongIndex]);
}

function playerPrev() {
    if (currentPlaylist.length === 0) return;
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }
    currentSongIndex = (currentSongIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    playSong(currentPlaylist[currentSongIndex]);
}

function playerShuffle() {
    isShuffle = !isShuffle;
    document.getElementById('shuffle-btn').classList.toggle('active', isShuffle);
}

function playerRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    const btn = document.getElementById('repeat-btn');
    btn.classList.toggle('active', repeatMode > 0);
    btn.innerHTML = repeatMode === 2 ? '<i class="fas fa-redo"></i><sub>1</sub>' : '<i class="fas fa-redo"></i>';
}

function onSongEnd() {
    if (repeatMode === 2) {
        audio.currentTime = 0;
        audio.play();
    } else if (repeatMode === 1 || currentSongIndex < currentPlaylist.length - 1) {
        playerNext();
    } else {
        isPlaying = false;
        updateMiniPlayer();
    }
}

function updatePlayerProgress() {
    if (!audio.duration) return;
    document.getElementById('player-current').textContent = formatTime(audio.currentTime);
    document.getElementById('player-seek').value = Math.floor(audio.currentTime);
}

function openPlayer() {
    if (!currentSong) return;
    document.getElementById('player-view').style.display = 'flex';
    updatePlayerUI();
}
function closePlayer() {
    document.getElementById('player-view').style.display = 'none';
    if (playerAnimFrame) cancelAnimationFrame(playerAnimFrame);
}

// ==================== COLOR EXTRACTION ====================
function extractColorsFromImage(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 50;
            canvas.height = 50;
            ctx.drawImage(img, 0, 0, 50, 50);

            const imageData = ctx.getImageData(0, 0, 50, 50).data;
            const colors = [];

            // Sample 4 regions of the image
            const regions = [
                { x: 5, y: 5 },
                { x: 25, y: 25 },
                { x: 40, y: 40 },
                { x: 5, y: 40 },
            ];

            regions.forEach(({ x, y }) => {
                const idx = (y * 50 + x) * 4;
                const r = imageData[idx];
                const g = imageData[idx + 1];
                const b = imageData[idx + 2];
                // Giữ gần màu gốc, chỉ tối 5%
                colors.push(`rgb(${Math.floor(r * 0.95)}, ${Math.floor(g * 0.95)}, ${Math.floor(b * 0.95)})`);
            });

            resolve(colors);
        };
        img.onerror = () => {
            resolve(['#1a1a2e', '#2d1b4e', '#0f0f23', '#1a0a2e']);
        };
        img.src = src;
    });
}

function startPlayerAnimation(colors) {
    if (playerAnimFrame) cancelAnimationFrame(playerAnimFrame);
    const bg = document.getElementById('player-bg');

    // Clear previous
    bg.innerHTML = '';
    bg.style.overflow = 'hidden';
    bg.style.background = '#0a0a1a';

    // Create rotating gradient layer
    const gradientLayer = document.createElement('div');
    gradientLayer.style.cssText = `
        position: absolute; inset: 0;
        background: linear-gradient(0deg, ${colors[0]}, ${colors[1]}, ${colors[2]}, ${colors[3] || colors[0]});
        transition: none;
    `;
    bg.appendChild(gradientLayer);

    // Rotation angle
    let angle = 0;

    function animate() {
        angle = (angle + 0.3) % 360;
        gradientLayer.style.background = `linear-gradient(${angle}deg, ${colors[0]} 0%, ${colors[1]} 35%, ${colors[2]} 65%, ${colors[3] || colors[0]} 100%)`;
        playerAnimFrame = requestAnimationFrame(animate);
    }
    animate();
}

function formatTime(s) {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ==================== VIEW NAVIGATION ====================
function openView(name, data) {
    const view = document.getElementById(`${name}-view`);
    if (view) {
        view.classList.add('open');
        if (name === 'playlist' && data) {
            switchMusicTab(data);
        }
    }
}
function closeView(name) {
    const view = document.getElementById(`${name}-view`);
    if (view) view.classList.remove('open');
}

// ==================== UPLOAD PHOTO ====================
function showUploadPhoto() {
    document.getElementById('upload-photo-modal').style.display = 'flex';
    document.getElementById('photo-date').value = new Date().toISOString().split('T')[0];
}
function hideUploadPhoto() {
    document.getElementById('upload-photo-modal').style.display = 'none';
    document.getElementById('photo-file').value = '';
    document.getElementById('photo-preview').style.display = 'none';
    document.getElementById('photo-caption').value = '';
}

function previewPhoto(input) {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('photo-preview');
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function submitPhoto() {
    const fileInput = document.getElementById('photo-file');
    if (!fileInput.files[0]) { alert('Chọn ảnh trước!'); return; }

    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);
    formData.append('caption', document.getElementById('photo-caption').value);
    formData.append('photoDate', document.getElementById('photo-date').value);

    try {
        const photo = await api('/api/photos', { method: 'POST', body: formData });
        photos.push(photo);
        renderHome();
        renderGallery();
        updateCountdown();
        hideUploadPhoto();
    } catch (e) { alert('Lỗi upload: ' + e.message); }
}

async function deletePhoto(id) {
    if (!confirm('Xóa ảnh này?')) return;
    await api(`/api/photos/${id}`, { method: 'DELETE' });
    photos = photos.filter(p => p.id !== id);
    renderHome();
    renderGallery();
    updateCountdown();
}

// ==================== UPLOAD MUSIC ====================
function showUploadMusic() {
    document.getElementById('upload-music-modal').style.display = 'flex';
}
function hideUploadMusic() {
    document.getElementById('upload-music-modal').style.display = 'none';
    document.getElementById('music-file').value = '';
    document.getElementById('cover-file').value = '';
    document.getElementById('music-title').value = '';
    document.getElementById('music-artist').value = '';
    document.getElementById('music-url').value = '';
    document.getElementById('music-filename').textContent = '';
    document.getElementById('cover-preview').style.display = 'none';
}

function switchUploadMode(mode) {
    uploadMode = mode;
    document.querySelectorAll('.upload-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.upload-tab[onclick*="${mode}"]`).classList.add('active');
    document.getElementById('upload-file-mode').style.display = mode === 'file' ? 'block' : 'none';
    document.getElementById('upload-link-mode').style.display = mode === 'link' ? 'block' : 'none';
}

function selectOwner(owner) {
    selectedOwner = owner;
    document.querySelectorAll('.owner-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.owner-btn[data-owner="${owner}"]`).classList.add('active');
}

function previewMusic(input) {
    if (input.files[0]) {
        const name = input.files[0].name.replace(/\.[^.]+$/, '');
        document.getElementById('music-filename').textContent = '🎵 ' + input.files[0].name;
        if (!document.getElementById('music-title').value) {
            document.getElementById('music-title').value = name;
        }
    }
}

function previewCover(input) {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('cover-preview');
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function submitMusic() {
    const title = document.getElementById('music-title').value;
    if (!title) { alert('Nhập tên bài hát!'); return; }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('artist', document.getElementById('music-artist').value);
    formData.append('owner', selectedOwner);

    if (uploadMode === 'file') {
        const audioFile = document.getElementById('music-file').files[0];
        if (!audioFile) { alert('Chọn file nhạc!'); return; }
        formData.append('audio', audioFile);
        const coverFile = document.getElementById('cover-file').files[0];
        if (coverFile) formData.append('cover', coverFile);
    } else {
        formData.append('url', document.getElementById('music-url').value);
    }

    try {
        const song = await api('/api/music', { method: 'POST', body: formData });
        allSongs.push(song);
        renderHome();
        renderPlaylist();
        updateCountdown();
        hideUploadMusic();
    } catch (e) { alert('Lỗi upload: ' + e.message); }
}

async function deleteSong(id) {
    if (!confirm('Xóa bài hát này?')) return;
    await api(`/api/music/${id}`, { method: 'DELETE' });
    allSongs = allSongs.filter(s => s.id !== id);
    renderHome();
    renderPlaylist();
    updateCountdown();
}

// ==================== SETTINGS ====================
function setBgType(type) {
    if (type === 'gradient') {
        document.getElementById('bg-gradient-btn').classList.add('active');
        document.getElementById('bg-image-btn').classList.remove('active');
        document.getElementById('gradient-options').style.display = 'block';
        document.getElementById('image-options').style.display = 'none';
    } else {
        document.getElementById('bg-image-btn').classList.add('active');
        document.getElementById('bg-gradient-btn').classList.remove('active');
        document.getElementById('gradient-options').style.display = 'none';
        document.getElementById('image-options').style.display = 'block';
    }
}

function setPreset(c1, c2) {
    document.getElementById('settings-color1').value = c1;
    document.getElementById('settings-color2').value = c2;
}

function uploadAvatar(which) {
    document.getElementById(`avatar${which}-input`).click();
}

async function handleAvatarUpload(which, input) {
    if (!input.files[0]) return;
    const formData = new FormData();
    formData.append('avatar', input.files[0]);
    formData.append('which', which.toString());
    try {
        settings = await api('/api/settings/avatar', { method: 'POST', body: formData });
        applySettings();
    } catch (e) { alert('Lỗi upload avatar: ' + e.message); }
}

async function handleBgUpload(input) {
    if (!input.files[0]) return;
    const formData = new FormData();
    formData.append('background', input.files[0]);
    try {
        settings = await api('/api/settings/background', { method: 'POST', body: formData });
        applySettings();
    } catch (e) { alert('Lỗi upload: ' + e.message); }
}

async function saveSettings() {
    const bgType = document.getElementById('bg-gradient-btn').classList.contains('active') ? 'gradient' : 'image';
    const data = {
        coupleName: document.getElementById('settings-name').value,
        anniversaryDate: document.getElementById('settings-date').value,
        backgroundType: bgType,
        gradientColor1: document.getElementById('settings-color1').value,
        gradientColor2: document.getElementById('settings-color2').value,
        themeColor: document.getElementById('settings-theme').value,
        animationIntensity: parseInt(document.getElementById('settings-intensity').value),
        enableHearts: document.getElementById('enable-hearts').checked,
        enableParticles: document.getElementById('enable-particles').checked,
        enableGradient: document.getElementById('enable-gradient').checked,
        enableParallax: document.getElementById('enable-parallax').checked,
    };

    try {
        settings = await api('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        applySettings();
        initAnimations();
        closeView('settings');
    } catch (e) { alert('Lỗi lưu: ' + e.message); }
}

// ==================== ANIMATIONS ====================
function initAnimations() {
    // Hearts
    const heartsCanvas = document.getElementById('hearts-canvas');
    heartsCtx = heartsCanvas.getContext('2d');
    heartsCanvas.width = window.innerWidth;
    heartsCanvas.height = window.innerHeight;

    // Particles
    const particlesCanvas = document.getElementById('particles-canvas');
    particlesCtx = particlesCanvas.getContext('2d');
    particlesCanvas.width = window.innerWidth;
    particlesCanvas.height = window.innerHeight;

    // Resize handler
    window.addEventListener('resize', () => {
        heartsCanvas.width = window.innerWidth;
        heartsCanvas.height = window.innerHeight;
        particlesCanvas.width = window.innerWidth;
        particlesCanvas.height = window.innerHeight;
    });

    // Create entities
    const intensity = settings.animationIntensity || 5;
    const heartCount = Math.floor(intensity * 2);
    const particleCount = Math.floor(intensity * 5);

    hearts = [];
    for (let i = 0; i < heartCount; i++) {
        hearts.push(createHeart(heartsCanvas));
    }

    particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push(createParticle(particlesCanvas));
    }

    if (animFrame) cancelAnimationFrame(animFrame);
    animateAll();
}

function createHeart(canvas) {
    return {
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 100,
        size: 10 + Math.random() * 20,
        speed: 0.3 + Math.random() * 0.7,
        opacity: 0.15 + Math.random() * 0.35,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.01 + Math.random() * 0.02,
    };
}

function createParticle(canvas) {
    return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 1 + Math.random() * 3,
        speed: 0.1 + Math.random() * 0.3,
        opacity: 0.2 + Math.random() * 0.5,
        twinkle: Math.random() * Math.PI * 2,
    };
}

function drawHeart(ctx, x, y, size, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#ff6b9d';
    ctx.beginPath();
    const topY = y - size * 0.4;
    ctx.moveTo(x, y + size * 0.3);
    ctx.bezierCurveTo(x - size * 0.5, topY, x - size, y, x, y + size * 0.6);
    ctx.moveTo(x, y + size * 0.3);
    ctx.bezierCurveTo(x + size * 0.5, topY, x + size, y, x, y + size * 0.6);
    ctx.fill();
    ctx.restore();
}

function animateAll() {
    const enableHearts = settings.enableHearts !== false;
    const enableParticles = settings.enableParticles !== false;

    // Hearts
    heartsCtx.clearRect(0, 0, heartsCtx.canvas.width, heartsCtx.canvas.height);
    if (enableHearts) {
        hearts.forEach(h => {
            h.y -= h.speed;
            h.wobble += h.wobbleSpeed;
            h.x += Math.sin(h.wobble) * 0.5;
            if (h.y < -30) {
                h.y = heartsCtx.canvas.height + 20;
                h.x = Math.random() * heartsCtx.canvas.width;
            }
            drawHeart(heartsCtx, h.x, h.y, h.size, h.opacity);
        });
    }

    // Particles
    particlesCtx.clearRect(0, 0, particlesCtx.canvas.width, particlesCtx.canvas.height);
    if (enableParticles) {
        particles.forEach(p => {
            p.y -= p.speed;
            p.twinkle += 0.03;
            const alpha = p.opacity * (0.5 + 0.5 * Math.sin(p.twinkle));
            if (p.y < -5) {
                p.y = particlesCtx.canvas.height + 5;
                p.x = Math.random() * particlesCtx.canvas.width;
            }
            particlesCtx.beginPath();
            particlesCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            particlesCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            particlesCtx.fill();
        });
    }

    animFrame = requestAnimationFrame(animateAll);
}

// ==================== PARALLAX ====================
function handleParallax() {
    if (settings.enableParallax === false) return;
    const scrollY = document.getElementById('home-scroll').scrollTop;
    const bg = document.getElementById('animated-bg');
    bg.style.transform = `translateY(${-scrollY * 0.3}px)`;
}

// ==================== TOUCH SWIPE (PHOTO VIEWER) ====================
let touchStartX = 0;
document.addEventListener('touchstart', (e) => {
    if (document.getElementById('photo-viewer').style.display !== 'none') {
        touchStartX = e.touches[0].clientX;
    }
}, { passive: true });
document.addEventListener('touchend', (e) => {
    if (document.getElementById('photo-viewer').style.display !== 'none') {
        const diff = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(diff) > 60) {
            if (diff < 0) nextPhoto();
            else prevPhoto();
        }
    }
}, { passive: true });
