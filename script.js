// ===== ตั้งค่าตรงนี้ =====
// วาง OAuth Client ID ที่ได้จาก Google Cloud Console
const GOOGLE_CLIENT_ID = '584146723929-sn43lnkamjsd9vqe0uffbj4o7v90mn9q.apps.googleusercontent.com';
// โฟลเดอร์ Google Drive ปลายทาง
const DRIVE_FOLDER_ID  = '16UPOiACjIWHtPzVO_adzYeHvkQLrOXRE';
const MAX_RECORD_SEC   = 30;

document.addEventListener('DOMContentLoaded', () => {
    let sanity = 100;
    let isRecording = false;
    let isUploading = false;
    let mediaRecorder;
    let recordedChunks = [];
    let stream;
    let curVideoBlob;
    let countdownInterval;
    let recordTimerInterval;
    let recordSeconds = 0;
    let tokenClient;
    let accessToken = null;

    const body          = document.body;
    const landingScreen = document.getElementById('landing-screen');
    const startWishBtn  = document.getElementById('start-wish-btn');
    const appContainer  = document.getElementById('app-container');
    const eyeContainer  = document.getElementById('kiriko-eye');
    const recordBtn     = document.getElementById('record-btn');
    const actionArea    = document.getElementById('action-area');
    const cameraFeed    = document.getElementById('camera-feed');
    const cameraFrame   = document.querySelector('.camera-frame');
    const driveOverlay  = document.getElementById('drive-overlay');
    const uploadStatus  = document.getElementById('upload-status');
    const countdownOverlay = document.getElementById('countdown-overlay');
    const countdownTimer   = document.getElementById('countdown-timer');
    const timerContainer   = document.getElementById('timer-container');
    const wishGrantedText  = document.getElementById('wish-granted-text');
    const sanityText    = document.getElementById('sanity-text');
    const sanityFill    = document.getElementById('sanity-fill');
    const feedList      = document.getElementById('feed-list');
    const glitchOverlay = document.getElementById('glitch-overlay');
    const instructionText = document.getElementById('instruction-text');

    // ========== LANDING SCREEN ==========
    startWishBtn.addEventListener('click', async () => {
        triggerHaptic([50]);
        startWishBtn.textContent = 'กำลังเชื่อมต่อโลกวิญญาณ...';
        startWishBtn.style.pointerEvents = 'none';

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
                audio: true
            });
            cameraFeed.srcObject = stream;
            cameraFeed.classList.add('active');

            setTimeout(() => {
                landingScreen.style.opacity = '0';
                setTimeout(() => {
                    landingScreen.style.display = 'none';
                    appContainer.style.display = 'flex';
                    void appContainer.offsetWidth;
                    appContainer.style.opacity = '1';
                    body.classList.add('pulsing');
                    eyeContainer.classList.add('open');
                    addFeedItem('[ระบบสอดแนม] เข้าถึงกล้องสำเร็จ', 'processing');
                    initGoogleAuth();
                }, 1500);
            }, 1000);

        } catch (err) {
            startWishBtn.textContent = 'ล้มเหลว: โปรดอนุญาตกล้อง';
            startWishBtn.style.color = 'var(--red-crimson)';
            startWishBtn.style.borderColor = 'var(--red-crimson)';
            triggerHaptic([100, 50, 100]);
            setTimeout(() => {
                startWishBtn.textContent = 'เริ่มขอพร';
                startWishBtn.style.color = '';
                startWishBtn.style.borderColor = '';
                startWishBtn.style.pointerEvents = 'auto';
            }, 3000);
        }
    });

    // ========== GOOGLE AUTH ==========
    function initGoogleAuth() {
        if (GOOGLE_CLIENT_ID === 'PASTE_YOUR_CLIENT_ID_HERE') {
            addFeedItem('[คำเตือน] ยังไม่ใส่ Client ID — วิดีโอจะบันทึกเฉพาะลงเครื่อง', 'completed');
            return;
        }
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: (resp) => {
                if (resp.error) {
                    console.error('Auth error:', resp.error);
                    addFeedItem('[Auth] ล้มเหลวในการเชื่อมต่อ Google', 'completed');
                    return;
                }
                accessToken = resp.access_token;
                addFeedItem('[Google Drive] เชื่อมต่อสำเร็จ ✓', 'processing');
                // ถ้ามีวิดีโอรอส่งอยู่ ให้ส่งเลย
                if (curVideoBlob && isUploading) uploadWithDriveAPI();
            }
        });
        addFeedItem('[Google Drive] พร้อมรับพิธีกรรม...', 'processing');
    }

    // ========== RECORDING ==========
    recordBtn.addEventListener('click', () => {
        if (isUploading) return;
        if (!isRecording) startRecording();
        else stopRecording();
    });

    function startRecording() {
        if (!stream) return;
        recordedChunks = [];
        recordSeconds = 0;

        const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
        let chosenMime = '';
        for (const m of mimeTypes) { if (MediaRecorder.isTypeSupported(m)) { chosenMime = m; break; } }

        mediaRecorder = new MediaRecorder(stream, chosenMime ? { mimeType: chosenMime } : {});
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.onstop = processVideo;
        mediaRecorder.start(1000);

        isRecording = true;
        recordBtn.classList.add('recording');
        cameraFrame.classList.add('recording');
        eyeContainer.classList.add('angry');
        body.classList.replace('pulsing', 'pulsing-fast');
        instructionText.style.color = 'var(--red-crimson)';
        instructionText.style.opacity = '1';

        recordTimerInterval = setInterval(() => {
            recordSeconds++;
            const rem = MAX_RECORD_SEC - recordSeconds;
            instructionText.textContent = `กำลังบันทึก... ${rem}s (กดเพื่อหยุด)`;
            if (recordSeconds >= MAX_RECORD_SEC) { clearInterval(recordTimerInterval); stopRecording(); }
        }, 1000);

        addFeedItem('[บันทึกคำสาปแช่ง] เริ่มรับฟังสัญญาณ...', 'processing');
        triggerHaptic([50, 50, 50]);
    }

    function stopRecording() {
        clearInterval(recordTimerInterval);
        if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        isRecording = false;
        recordBtn.classList.remove('recording');
        cameraFrame.classList.remove('recording');
        body.classList.replace('pulsing-fast', 'pulsing');
        instructionText.textContent = 'กำลังประมวลผลคำสาป...';
        triggerHaptic([100, 50, 200]);
    }

    // ========== PROCESS VIDEO ==========
    function processVideo() {
        curVideoBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
        const sizeMB = (curVideoBlob.size / 1024 / 1024).toFixed(1);
        addFeedItem(`[ขนาดไฟล์] ${sizeMB} MB — กำลังส่งขึ้น Drive...`, 'processing');

        isUploading = true;
        recordBtn.style.opacity = '0.2';
        recordBtn.style.pointerEvents = 'none';
        driveOverlay.classList.add('active');
        applyCost(35);

        if (GOOGLE_CLIENT_ID === 'PASTE_YOUR_CLIENT_ID_HERE') {
            // โหมดจำลอง: ไม่มี Client ID
            uploadStatus.textContent = 'บันทึกลงเครื่อง (ยังไม่มี Client ID)';
            downloadLocalCopy();
            setTimeout(() => { driveOverlay.querySelector('.spinner').style.display = 'none'; }, 500);
            setTimeout(() => startWishGrantedSequence(), 2000);
            return;
        }

        uploadStatus.textContent = 'กำลังขอสิทธิ์เข้าถึง Google Drive...';

        if (accessToken) {
            uploadWithDriveAPI();
        } else {
            // ขอ token → callback จะเรียก uploadWithDriveAPI เอง
            tokenClient.requestAccessToken({ prompt: '' });
        }
    }

    // ========== GOOGLE DRIVE API UPLOAD (ส่งตรง ไม่ผ่าน Apps Script) ==========
    async function uploadWithDriveAPI() {
        uploadStatus.textContent = 'กำลังอัปโหลดวิดีโอ...';
        const filename = `kiriko_${Date.now()}.webm`;

        try {
            // Multipart upload: ส่งเป็น binary ตรงๆ ไม่ต้อง Base64
            const metadata = JSON.stringify({ name: filename, parents: [DRIVE_FOLDER_ID] });

            const form = new FormData();
            form.append('metadata', new Blob([metadata], { type: 'application/json' }));
            form.append('file', curVideoBlob, filename);

            const resp = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}` },
                    body: form
                }
            );

            if (!resp.ok) {
                const errText = await resp.text();
                throw new Error(`Drive API: ${resp.status} — ${errText}`);
            }

            const result = await resp.json();
            console.log('✅ Upload success, file ID:', result.id);

            uploadStatus.textContent = 'อัปโหลดสำเร็จ ✓';
            driveOverlay.querySelector('.spinner').style.display = 'none';
            addFeedItem('[สมบูรณ์] คำสาปแช่งถูกส่งเข้า Google Drive แล้ว', 'completed');
            triggerHaptic([500]);
            downloadLocalCopy();
            setTimeout(() => startWishGrantedSequence(), 2000);

        } catch (err) {
            console.error('Upload error:', err);
            uploadStatus.textContent = 'ล้มเหลว — บันทึกลงเครื่องแทน';
            driveOverlay.querySelector('.spinner').style.display = 'none';
            addFeedItem('[ข้อผิดพลาด] ' + err.message, 'completed');
            downloadLocalCopy();
            setTimeout(() => startWishGrantedSequence(), 3000);
        }
    }

    function downloadLocalCopy() {
        if (!curVideoBlob) return;
        const url = URL.createObjectURL(curVideoBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `kiriko_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    }

    // ========== END SEQUENCE ==========
    function startWishGrantedSequence() {
        driveOverlay.classList.remove('active');
        actionArea.classList.add('hidden');
        eyeContainer.classList.remove('angry');
        countdownOverlay.classList.add('active');

        setTimeout(() => {
            wishGrantedText.classList.add('show');
            triggerHaptic([200, 100, 200]);

            setTimeout(() => {
                wishGrantedText.classList.remove('show');
                setTimeout(() => {
                    wishGrantedText.style.display = 'none';
                    timerContainer.style.display = 'flex';
                    void timerContainer.offsetWidth;
                    timerContainer.style.opacity = '1';
                    startCountdownTimer();
                }, 1000);
            }, 3000);
        }, 500);
    }

    function startCountdownTimer() {
        addFeedItem('[คำพิพากษา] เริ่มนับถอยหลัง 24 ชั่วโมง...', 'completed');
        triggerHaptic([200, 100, 200, 100, 200]);
        let timeRemaining = 24 * 60 * 60;
        clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            timeRemaining--;
            if (timeRemaining <= 0) { clearInterval(countdownInterval); triggerGameOver(); return; }
            const h = Math.floor(timeRemaining / 3600).toString().padStart(2, '0');
            const m = Math.floor((timeRemaining % 3600) / 60).toString().padStart(2, '0');
            const s = (timeRemaining % 60).toString().padStart(2, '0');
            countdownTimer.textContent = `${h}:${m}:${s}`;
        }, 1000);
    }

    // ========== UTILITIES ==========
    function applyCost(cost) {
        sanity -= cost;
        if (sanity < 0) sanity = 0;
        sanityText.textContent = `${sanity}%`;
        sanityFill.style.width = `${sanity}%`;
        if (sanity <= 45 && sanity > 0) { body.classList.add('low-sanity'); glitchOverlay.style.opacity = '0.4'; }
        if (sanity === 0) triggerGameOver();
    }

    function addFeedItem(text, type) {
        const li = document.createElement('li');
        li.className = `feed-item ${type}`;
        li.textContent = text;
        feedList.prepend(li);
        if (feedList.children.length > 6) feedList.lastChild.remove();
    }

    function triggerGameOver() {
        glitchOverlay.style.opacity = '1';
        triggerHaptic([1000, 100, 1000]);
        setTimeout(() => {
            document.getElementById('app-container').style.display = 'none';
            const d = document.createElement('div');
            d.className = 'dead-screen';
            d.innerHTML = `<h1>0% SANITY</h1><p>คุณถูกคำสาปกลืนกินโดยสมบูรณ์...</p><div style="font-size:12px;margin-top:40px;color:#444">Google Drive Sync Failed: User no longer exists.</div>`;
            document.body.appendChild(d);
        }, 1500);
    }

    function triggerHaptic(pattern) {
        if ('vibrate' in navigator) { try { navigator.vibrate(pattern); } catch (e) { } }
    }
});
