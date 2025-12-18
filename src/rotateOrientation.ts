import type { HowlerAudioManager } from './assets/howler-manager/HowlerAudioManager'; // <-- sửa path đúng theo dự án bạn

// ================== STATE CHUNG ==================

let bgmStarted = false;

let rotateOverlay: HTMLDivElement | null = null;
let isRotateOverlayActive = false;

// Howler audio
let audioRef: HowlerAudioManager | null = null;

let currentVoiceKey: string | null = null;
let pendingQuestionKey: string | null = null;

let lastRotateVoiceTime = 0;
const ROTATE_VOICE_COOLDOWN = 1500; // ms

let audioUnlockedByUser = false; // ✅ tap 1 lần là unlock, các lần sau auto play
let rotateInited = false; // ✅ tránh addEventListener nhiều lần (nếu bạn init nhiều scene)

// ✅ NEW: debounce update để tránh innerWidth/innerHeight “lỡ cỡ”
let rafId: number | null = null;
function scheduleUpdateRotateHint() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
        updateRotateHint();
        // iOS/Safari đôi khi cập nhật kích thước trễ 1 frame
        requestAnimationFrame(updateRotateHint);
    });
}

// ✅ NEW: lấy size ổn định hơn trên mobile (đặc biệt iOS)
function getViewportSize() {
    const vv = window.visualViewport;
    const w = vv?.width ?? window.innerWidth;
    const h = vv?.height ?? window.innerHeight;
    return { w, h };
}

// ================== ƯU TIÊN VOICE ==================
function getVoicePriority(key: string): number {
    if (key.startsWith('drag_') || key.startsWith('q_')) return 1;
    if (key === 'voice_need_finish') return 2;
    if (key === 'sfx_correct' || key === 'sfx_wrong') return 3;
    if (
        key === 'voice_complete' ||
        key === 'voice_intro' ||
        key === 'voice_end' ||
        key === 'voice_rotate'
    ) {
        return 4;
    }
    return 1;
}

/**
 * Dùng HowlerAudioManager thay vì Phaser.Sound
 * - Khi overlay xoay đang bật: chỉ cho phép phát voice_rotate
 * - Có priority để tránh voice thấp đè voice cao
 */
export function playVoiceLocked(audio: HowlerAudioManager, key: string): void {
    // Nếu đang cần xoay ngang -> chỉ cho phép voice_rotate
    if (isRotateOverlayActive && key !== 'voice_rotate') {
        pendingQuestionKey = key;
        return;
    }

    const newPri = getVoicePriority(key);
    const curPri = currentVoiceKey ? getVoicePriority(currentVoiceKey) : 0;

    // Nếu đang có voice "ưu tiên cao hơn hoặc bằng" thì bỏ qua voice mới
    if (currentVoiceKey && curPri >= newPri && currentVoiceKey !== key) return;

    // Stop voice hiện tại rồi play voice mới
    audio.stopAllVoices();
    currentVoiceKey = key;

    audio.play(key, {
        stopSame: true,
        onEnd: () => {
            if (currentVoiceKey === key) currentVoiceKey = null;
        },
    });
}

// ================== UI OVERLAY XOAY NGANG ==================
function ensureRotateOverlay() {
    if (rotateOverlay) return;

    rotateOverlay = document.createElement('div');
    rotateOverlay.id = 'rotate-overlay';
    rotateOverlay.style.position = 'fixed';
    rotateOverlay.style.inset = '0';
    rotateOverlay.style.zIndex = '9999';
    rotateOverlay.style.display = 'none';
    rotateOverlay.style.alignItems = 'center';
    rotateOverlay.style.justifyContent = 'center';
    rotateOverlay.style.textAlign = 'center';
    rotateOverlay.style.background = 'rgba(0, 0, 0, 0.6)';
    rotateOverlay.style.padding = '16px';
    rotateOverlay.style.boxSizing = 'border-box';

    const box = document.createElement('div');
    box.style.background = 'white';
    box.style.borderRadius = '16px';
    box.style.padding = '16px 20px';
    box.style.maxWidth = '320px';
    box.style.margin = '0 auto';
    box.style.fontFamily =
        '"Fredoka", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    box.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';

    const title = document.createElement('div');
    title.textContent = 'Bé Hãy Xoay Ngang Màn Hình Để Chơi Nhé 🌈';
    title.style.fontSize = '18px';
    title.style.fontWeight = '700';
    title.style.marginBottom = '8px';
    title.style.color = '#222';

    box.appendChild(title);
    rotateOverlay.appendChild(box);
    document.body.appendChild(rotateOverlay);
}

// ================== CORE LOGIC XOAY + ÂM THANH ==================
function tryPlayRotateVoice() {
    if (!audioRef) return;

    const now = Date.now();
    if (now - lastRotateVoiceTime < ROTATE_VOICE_COOLDOWN) return;
    lastRotateVoiceTime = now;

    playVoiceLocked(audioRef, 'voice_rotate');
}

function updateRotateHint() {
    ensureRotateOverlay();
    if (!rotateOverlay) return;

    // ❗️CHANGED: dùng viewport size ổn định hơn
    const { w, h } = getViewportSize();
    const shouldShow = h > w && w < 768; // portrait & nhỏ

    const overlayWasActive = isRotateOverlayActive;
    isRotateOverlayActive = shouldShow;

    const overlayTurnedOn = !overlayWasActive && shouldShow;
    const overlayTurnedOff = overlayWasActive && !shouldShow;

    rotateOverlay.style.display = shouldShow ? 'flex' : 'none';

    if (!audioRef) return;

    if (overlayTurnedOn) {
        if (currentVoiceKey && currentVoiceKey !== 'voice_rotate') {
            pendingQuestionKey = currentVoiceKey;
        }

        audioRef.stopAllExceptBgm('bgm_quantity');
        currentVoiceKey = null;

        if (audioUnlockedByUser) {
            tryPlayRotateVoice();
        }
    }

    if (overlayTurnedOff) {
        audioRef.stopAllExceptBgm('bgm_quantity');
        currentVoiceKey = null;

        if (!bgmStarted) {
            audioRef.playBgm('bgm_quantity');
            bgmStarted = true;
        }

        // ✅ Chỉ phát lại pending prompt khi đã unlock (sau click đầu tiên)
        // ✅ Nếu chưa unlock thì GIỮ pending lại, không phát tự động (tránh hên xui + tránh double)
        if (pendingQuestionKey) {
            if (audioUnlockedByUser) {
                playVoiceLocked(audioRef, pendingQuestionKey);
                pendingQuestionKey = null;
            }
        }
    }
}

// ================== KHỞI TẠO HỆ THỐNG XOAY ==================
export function initRotateOrientation(options: {
    audio: HowlerAudioManager;
    overlaySceneKey?: string | null;
    mainSceneKey?: string;
}) {
    audioRef = options.audio;

    ensureRotateOverlay();
    // ❗️CHANGED: dùng schedule thay vì gọi thẳng
    scheduleUpdateRotateHint();

    if (rotateInited) return;
    rotateInited = true;

    // ❗️CHANGED: resize/orientationchange dùng schedule để tránh “lúc được lúc không”
    window.addEventListener('resize', scheduleUpdateRotateHint);

    window.addEventListener('orientationchange', () => {
        scheduleUpdateRotateHint();
        // iOS/Safari hay cập nhật size trễ -> gọi lại sau 250ms
        setTimeout(scheduleUpdateRotateHint, 250);
    });

    window.addEventListener('pointerdown', () => {
        if (!isRotateOverlayActive) return;

        audioUnlockedByUser = true;
        tryPlayRotateVoice();
    });
}
