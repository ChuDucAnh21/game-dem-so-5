# Game số lượng 5: tô 5 vòng, khoanh 5 chổi

Web game Phaser (Vite + TypeScript) giúp trẻ 5–6 tuổi tập đếm số lượng 5.  
Bước 1: tô 5 vòng tròn.  
Bước 2: khoanh lại đúng 5 chiếc chổi trong bảng đồ vật rơi xuống.

Canvas 1280×720, scale FIT, chạy trong DOM container `#game-container` với các lớp nền `#bg-layer-a/b`.

---

## Chạy nhanh

```bash
npm install      # cài dependency
npm run dev      # dev + hot reload
npm run build    # build production
npm run preview  # xem thử bundle đã build
```

---

## Cấu trúc chính

- `src/main.ts`: cấu hình game (1280×720, Scale.FIT, pixelRatio theo DPR), gắn vào `#game-container`, resize an toàn trên mobile, show/hide nút DOM `#btn-reset`, auto scale UI.

- `src/game/quantity/quantityLevels.ts`: danh sách level. Hiện tại 1 level (id 1) với số 5, icon `candle`, `objectCount = 5`.

- `src/scenes/QuantityScene.ts`: gameplay chính. Tạo 7 vòng tròn có thể tô màu, xử lý nút "KIỂM TRA", kiểm tra đúng/sai, phát prompt/nhạc/SFX, đếm số, gọi overlay khoanh chổi, chuyển level, reset.

- `src/components/game/CircleCheckOverlay.ts`: màn khoanh đồ vật. Layout tối đa 14 icon (3 hàng), cho vẽ đường không cắt khúc (đóng vòng) và đếm icon nằm trong vùng khoanh. Phản hồi đúng/sai bằng âm thanh và màu xanh/đỏ.

- `src/scenes/EndGameScene.ts`: màn kết. Banner chúc mừng, confetti, nút Chơi lại (reset lại QuantityScene, giữ audio manager), nút Thoát (gọi `irukaHost.complete` nếu có).

- `src/rotateOrientation.ts`: overlay bắt người chơi xoay ngang, tạm dừng âm thanh khi ở portrait, phát lại khi về landscape.

- `public/assets/...`: ảnh nền, icon đồ vật (ví dụ `candle`, `broom`), UI (title_banner, circle_empty, tick), âm thanh (bgm_quantity, prompt/correct/try-again, sfx-click/correct/wrong).
---

## Gameplay

### Bước 1: Tô vòng tròn (số 5)
- 7 vị trí vòng tròn xếp ngang (`circle_empty`) để trẻ tô. Brush màu xanh tím, bán kính 24, grid 10×10, cần tô ≥ 90% diện tích để được tính.

- Nút "KIỂM TRA" ở dưới giữa. Reset DOM `#btn-reset` ở góc trên phải để quay về level 1.

- Nếu đúng số vòng yêu cầu (`objectCount = 5`):
  - Vòng đạt yêu cầu được tô xanh lá, hiện số đếm 1..5 dưới từng icon.
  - Phát `sfx-correct`, voice khen (`correct_quantity_draw`, `correct_draw_candle`), đếm 1–5 (`count_*`).
  - Chuyển sang bước 2 (overlay khoanh chổi).

- Nếu sai:
  - Rung vòng, phát `sfx-wrong` + voice nhắc làm lại, xoá màu đã tô, giữ nguyên layout để tô lại.

### Bước 2: Khoanh 5 chiếc chổi
- `CircleCheckOverlay` rơi xuống: nền panel trắng viền xanh, che 3/4 màn hình phải.

- 14 icon rơi (`broom`), chia 3 hàng, nhún nhảy nhẹ. `expectedCount = 5`.

- Trẻ vẽ một đường khép kín trong panel để khoanh đúng 5 icon:
  - Nếu khoanh đúng: tô vùng xanh, phát voice `correct_quantity_circle` (hoặc `sfx-correct`) và chuyển level tiếp.
  - Nếu khoanh sai hoặc vòng hở/quá nhỏ: tô đỏ, phát `voice_try_again_circel` (hoặc `sfx-wrong`), xoá nét vẽ để làm lại.

### Kết thúc
- Hết level sẽ sang `EndGameScene`: phát `complete` → `fireworks` → `applause`, banner chúc mừng, confetti liên tục.

- Nút `btn_reset`: về lại QuantityScene (giữ audio sẵn sàng).  
  Nút `btn_exit`: gọi host nếu chạy trong IruKa hub, fallback sang LessonSelectScene nếu không có host.

---

## Level, UI, audio

- Level hiện tại (`buildQuantityLevels`):
  - id 1, số 5, tên "cây nến", `objectIcon` [`candle`], `objectCount` 5, `maxCircles` 4 (nhưng layout vẽ 7 vòng; `objectCount` quy định số vòng phải tô).

  - Voice: `prompt_quantity_draw`, `correct_quantity_draw`, `correct_draw_candle`.

- Nền DOM crossfade giữa `#bg-layer-a/b` (mặc định home → lake); map nền mở rộng trong `bgByIcon` nếu cần thêm icon mới.

- Audio unlock trên lần chạm đầu (iOS): `HowlerAudioManager` + Howler. BGM loop `bgm_quantity`; prompt/feedback chạy bằng HTML5 audio cho an toàn mobile. `playVoiceLocked` dùng khi thiết bị đang portrait.

---

## Hướng dẫn phát triển

- Toàn bộ text trong README không dấu trước đây để tránh lỗi mã hoá. Font game `Baloo 2` được preload trong `main.ts`.

- Canvas sử dụng Scale.FIT, làm mới `--vh` để tránh thanh địa chỉ mobile; gọi `game.scale.refresh()` khi resize.

- Khi thêm level mới: bổ sung vào `buildQuantityLevels` (`objectCount`, icon, prompt/correct voice), thêm asset vào `public/assets` và preload key trong `quantityAssets.ts`.

- Hiệu ứng khoanh có thể reuse `CircleCheckOverlay.show({ expectedCount, items, promptKey, successKey, failKey })` cho các chủ đề khác (đổi key icon và số lượng mong đợi).
