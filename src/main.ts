import Phaser from 'phaser';
import { QuantityScene } from './scenes/QuantityScene';
import { EndGameScene } from './scenes/EndGameScene';

declare global {
    interface Window {
        compareScene: any;
    }
}
const DPR = Math.min(2, window.devicePixelRatio || 1); // tránh quá nặng trên máy yếu


const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#ffffff',
    scene: [QuantityScene, EndGameScene],
    scale: {
        mode: Phaser.Scale.FIT, // Canvas tự fit vào container
        autoCenter: Phaser.Scale.NO_CENTER,
        // zoom: DPR, 
    },
    render: {
        pixelArt: false,
        antialias: true,
        transparent: true,
        roundPixels:true,
         pixelRatio: DPR,
    } as any
};



async function ensureFontsReady() {
  // kích hoạt tải font chắc chắn
  await document.fonts.load(`400 48px "Baloo 2"`);
  await document.fonts.load(`700 48px "Baloo 2"`);
  await document.fonts.ready;

  // check chắc ăn
  const start = performance.now();
  while (performance.now() - start < 4000) {
    if (
      document.fonts.check(`400 48px "Baloo 2"`) &&
      document.fonts.check(`700 48px "Baloo 2"`)
    ) break;
    await new Promise((r) => setTimeout(r, 50));
  }
}
window.addEventListener("load", async () => {
  await ensureFontsReady();
});
 const game = new Phaser.Game(config);
 
(window as any).__game = game; // ✅ expose game
 //-------------
function applySafeVh() {
  const vv = window.visualViewport;
  const h = Math.round(vv?.height ?? window.innerHeight);

  document.documentElement.style.setProperty("--vh", `${h * 0.01}px`);

  const container = document.getElementById("game-container");
  if (container) {
    container.style.width = "100vw";
    container.style.height = `calc(var(--vh) * 100)`;
  }

  game.scale.refresh(); // quan trọng với FIT
}
function stabilize() {
  applySafeVh();
  requestAnimationFrame(applySafeVh);
  setTimeout(applySafeVh, 250);
}
window.addEventListener("resize", stabilize);
window.addEventListener("orientationchange", stabilize);
window.visualViewport?.addEventListener("resize", stabilize);
window.visualViewport?.addEventListener("scroll", stabilize);
stabilize();
//------------


function updateUIButtonScale() {
    const container = document.getElementById('game-container')!;
    const resetBtn = document.getElementById('btn-reset') as HTMLImageElement;

    const w = container.clientWidth;
    const h = container.clientHeight;

    // base height = 720 (game design gốc)
    const scale = Math.min(w, h) / 720;

    const baseSize = 80; // kích thước nút thiết kế gốc (80px)
    const newSize = baseSize * scale;

    resetBtn.style.width = `${newSize}px`;
    resetBtn.style.height = 'auto';
}

export function showGameButtons() {
    const reset = document.getElementById('btn-reset');

    reset!.style.display = 'block';
}

export function hideGameButtons() {
    const reset = document.getElementById('btn-reset');

    reset!.style.display = 'none';
}

function scheduleUpdateUIButtonScale() {
  requestAnimationFrame(updateUIButtonScale);
  setTimeout(updateUIButtonScale, 250);
}

scheduleUpdateUIButtonScale();
document.getElementById('btn-reset')?.addEventListener('click', () => {
  const game = (window as any).__game as Phaser.Game;
  if (!game) return;

  // lấy audio từ scene nào cũng được
  const anyScene = (game.scene.getScenes(true)[0] as any) || (window as any).compareScene;
  const audio = anyScene?.audio;

  // dừng hết voice/sfx đang chạy, giữ BGM (nếu đang có)
  audio?.stopAllExceptBgm?.('bgm_quantity');

  // ✅ QUAN TRỌNG: start lại QuantityScene bằng SceneManager
  game.scene.start('QuantityScene', {
    audio,
    audioReady: true,
    forcePrompt: true,
  });
});

window.addEventListener("resize", scheduleUpdateUIButtonScale);
window.addEventListener("orientationchange", scheduleUpdateUIButtonScale);
window.visualViewport?.addEventListener("resize", scheduleUpdateUIButtonScale);




