Tách làm 2 phần:

1. Mô tả rõ gameplay cho người không rành kỹ thuật.
2. Chuyển thành requirement & task cụ thể cho dev.

---

## 1. Mô tả rõ game (cho giáo viên / designer)

**Tên tạm:** Bằng nhau – Nhiều hơn – Ít hơn (chủ đề biển)

**Mục tiêu học tập**

* Trẻ đếm số lượng trong phạm vi (ví dụ: 1–10).
* Trẻ so sánh hai nhóm đồ vật và dùng đúng từ: *bằng nhau, nhiều hơn, ít hơn*.

### Biến thể 1 – Chọn dấu so sánh

* Màn hình hiển thị **2 nhóm con vật biển** (ví dụ: rùa bên trái, cá heo bên phải).
* Giữa hai nhóm có một **vị trí trống** để chọn dấu:

  * `=` (bằng nhau)
  * `>` (nhiều hơn)
  * `<` (ít hơn)
* Bên dưới hoặc bên cạnh hiện **3 nút/dấu tròn** chứa ba ký hiệu trên.

**Luật chơi:**

1. Bé nhìn 2 nhóm con vật, tự đếm số lượng mỗi bên.
2. Bé bấm vào dấu so sánh mà bé cho là đúng.
3. Nếu đúng:

   * Dấu bay lên vị trí trống, có hiệu ứng sáng, âm thanh vui.
   * Nhân vật dẫn chuyện khen thưởng, đọc lại câu:

     > “Nhóm rùa **ít hơn** nhóm cá heo.”
4. Nếu sai:

   * Hiệu ứng lắc nhẹ, âm thanh “ủa sai rồi”.
   * Có gợi ý (ví dụ: tô sáng lần lượt từng nhóm để bé đếm lại).

---

### Biến thể 2 – Chọn bên nhiều hơn / ít hơn (giống screenshot Lucas/kids game)

* Màn hình hiển thị **2 bảng**: bên trái và bên phải.
* Mỗi bảng có một nhóm con vật (cá, rùa…) với số lượng khác nhau.
* Trên thanh tiêu đề hoặc lời thoại nhân vật có **yêu cầu rõ**:

  * “Chọn bên có **nhiều hơn**.”
  * Hoặc: “Chọn bên có **ít hơn**.”

**Luật chơi:**

1. Bé đọc/được đọc yêu cầu.
2. Bé chạm vào bên trái hoặc bên phải.
3. Nếu chọn đúng:

   * Bảng được chọn nhảy nhẹ, có viền sáng, âm thanh “ting”.
   * Nhân vật nói: “Bên phải có **nhiều cá hơn**.”
4. Nếu chọn sai:

   * Bảng lắc nhẹ, âm thanh báo sai.
   * Có thể hiện thêm gợi ý đếm (ví dụ: highlight từng con vật).

---

### Tiến trình chơi

* Một “level” có thể gồm 3–5 lượt so sánh.
* Mỗi lượt dùng cặp số khác nhau (ví dụ: 3–3, 4–7, 8–5...).
* Kết thúc level:

  * Màn hình tổng kết: số câu đúng, sticker khen, gợi ý “Chơi lại” hoặc “Tiếp tục”.

---

## 2. Chuyển thành mô tả kỹ thuật & công việc cần dev

Phần này nói cho dev hiểu rõ mình phải build cái gì.

### 2.1. Thông số chung

* **Nền tảng:** Web game chạy trong Iruka Game Hub (desktop + mobile).
* **Tỉ lệ màn hình:** 16:9, auto scale để không vỡ layout trên mobile.
* **Engine:** Phaser/PixiJS hoặc engine đang dùng chung (dev tự chọn theo stack Iruka).
* **Ngôn ngữ:** Text tiếng Việt, hỗ trợ thay text từ file config (JSON).

---

### 2.2. Cấu trúc màn hình (Main Game Scene)

1. **Layer background**

   * Ảnh nền chủ đề biển (nhẹ, tối ưu dung lượng).

2. **Khu vực chơi chính (play area)**

   * **Biến thể 1 (chọn dấu):**

     * Nhóm trái: sprite “đàn rùa/cá” – gồm nhiều instance cùng 1 sprite.
     * Nhóm phải: tương tự.
     * Vị trí trống ở giữa để hiển thị dấu so sánh khi bé chọn.
     * Khu vực 3 nút/dấu chọn (`<`, `=`, `>`).
   * **Biến thể 2 (chọn bên):**

     * Hai “bảng” (panel) trái và phải, mỗi panel chứa nhóm con vật.
     * State clickable cho mỗi panel.

3. **Thanh tiêu đề / câu hỏi**

   * Text hiển thị yêu cầu hiện tại:

     * “Chọn dấu đúng.”
     * Hoặc “Chọn bên có nhiều hơn.” / “Chọn bên có ít hơn.”

4. **UI phụ**

   * Nút Home, Replay, Next.
   * Thanh progress đơn giản (ví dụ: 3/5 câu).

---

### 2.3. Cấu trúc dữ liệu level (gợi ý JSON)

```json
[
  {
    "id": 1,
    "mode": "operator",          // "operator" = chọn dấu, "side" = chọn bên
    "left": { "icon": "turtle", "count": 3 },
    "right": { "icon": "dolphin", "count": 5 },
    "relation": "<"              // 3 < 5
  },
  {
    "id": 2,
    "mode": "side",              // chọn bên nhiều/ít hơn
    "left": { "icon": "fish", "count": 8 },
    "right": { "icon": "fish", "count": 4 },
    "question_type": "more",     // "more" hoặc "less"
    "correct_side": "left"
  }
]
```

**Task dev:**

* Tạo file config JSON cho level, có thể tách:

  * `operatorLevels.json`
  * `sideLevels.json`.

---

### 2.4. Luồng logic game

**Cho mỗi level:**

1. Load config (left, right, mode…).

2. Vẽ số lượng sprite theo `count` ở vị trí grid trong mỗi nhóm/panel.

3. Hiển thị câu hỏi tương ứng:

   * `mode = "operator"` → “Chọn dấu đúng.”
   * `mode = "side"` + `question_type = "more"` → “Chọn bên có nhiều hơn.”

4. Lắng nghe input:

   * `mode = "operator"`: click vào 1 trong 3 nút `<`, `=`, `>`.
   * `mode = "side"`: click vào panel trái hoặc phải.

5. Kiểm tra đúng/sai:

   * với `relation`: so sánh input user với giá trị config.
   * với `correct_side`: so sánh lựa chọn với `"left" | "right"`.

6. Xử lý kết quả:

   * Nếu đúng:

     * Cập nhật điểm +1, play animation + sound đúng, hiển thị câu giải thích (string lấy từ hàm template: “X bên trái [ít/nhiều hơn/bằng] bên phải”).
     * Sau delay ngắn, chuyển sang level tiếp theo.
   * Nếu sai:

     * Play animation lắc + sound sai.
     * Hiển thị gợi ý (tùy scope: highlight từng con vật để bé đếm).
     * Cho phép chọn lại tối đa N lần (ví dụ 2 lần), sau đó auto show đáp án nếu vẫn sai.

7. Kết thúc set level:

   * Hiển thị màn hình tổng kết.
   * Gửi callback cho hệ thống (nếu Iruka tracking kết quả): số câu đúng, tổng câu, thời gian.

---

### 2.5. Công việc cụ thể cho dev

**1. Setup project**

* Tạo scene `CompareQuantityScene` (hoặc tương đương).
* Tạo hệ thống load asset:

  * Sprite sheet con vật (`turtle`, `dolphin`, `fish`)
  * UI buttons, panels, background, icon dấu `<`, `=`, `>`.
  * SFX: đúng, sai, click.

**2. Implement renderer cho 2 mode**

* Hàm `renderOperatorMode(levelConfig)`

  * Vẽ hai nhóm sprite theo `left.count`, `right.count`.
  * Render 3 nút dấu so sánh, add pointer event.

* Hàm `renderSideMode(levelConfig)`

  * Vẽ 2 panel clickable, bên trong là các sprite con vật.

**3. Implement game state**

* Biến `currentLevelIndex`, `score`, `totalLevels`.
* Hàm `loadLevel(index)` → clear objects cũ, render level mới.
* Hàm `handleAnswer(result)`:

  * Nhận tham số `isCorrect`.
  * Trigger animation, âm thanh, update điểm, move to next level.

**4. Animation & feedback**

* Hiệu ứng:

  * Tween scale lên/xuống khi đúng.
  * Tween lắc trái/phải khi sai.
* Optional: hiệu ứng particle nhỏ (bubbles) khi đúng.

**5. Tối ưu & config**

* Tất cả text (tiêu đề, câu khen, gợi ý) đặt trong file `localization_vi.json` để dễ chỉnh.
* Asset tối ưu dung lượng:

  * Background dạng WebP hoặc SVG.
  * Sprite con vật có thể dùng spritesheet (webP).

**6. Tích hợp với hệ thống Iruka**

* Nhận params từ ngoài (ví dụ: độ khó, số lượng câu).
* Emit event / callback khi:

  * Bắt đầu game.
  * Kết thúc 1 lượt.
  * Kết thúc game.

---

