import Phaser from 'phaser';
import type { HowlerAudioManager } from '../../assets/howler-manager/HowlerAudioManager';

export type CircleCheckItem = {
    key: string;
    x?: number; // (không cần set nữa nếu dùng auto layout)
    y?: number;
    scale?: number;
};

export type CircleCheckOverlayOptions = {
    expectedCount: number;
    items: CircleCheckItem[];

    promptKey?: string; // voice hướng dẫn khi bảng rơi xuống
    successKey?: string; // voice chúc mừng
    failKey?: string; // voice làm lại
    dimAlpha?: number; // ✅ độ tối nền khi overlay bật (0..1)

    onSuccess: () => void;
};

export class CircleCheckOverlay {
    private scene: Phaser.Scene;
    private audio?: HowlerAudioManager;

    private itemTweens: Phaser.Tweens.Tween[] = [];

    private root?: Phaser.GameObjects.Container;
    private blocker?: Phaser.GameObjects.Rectangle;

    private panel?: Phaser.GameObjects.Container;
    private panelBg?: Phaser.GameObjects.Graphics;

    private itemsSprites: Phaser.GameObjects.Image[] = [];

    private drawGfx?: Phaser.GameObjects.Graphics; // nét vẽ
    private resultGfx?: Phaser.GameObjects.Graphics; // tô xanh/đỏ vùng khoanh

    private drawing = false;
    private points: Phaser.Math.Vector2[] = [];

    private expectedCount = 0;
    private onSuccess?: () => void;

    private panelX = 0;
    private panelY = 0;
    private panelW = 0;
    private panelH = 0;

    // layout
    private readonly rows = 3;
    private readonly maxItems = 14;

    constructor(scene: Phaser.Scene, audio?: HowlerAudioManager) {
        this.scene = scene;
        this.audio = audio;
    }

    /** gọi 1 lần trong create() */
    public init() {
        const w = this.scene.scale.width + 0.9;
        const h = this.scene.scale.height + 0.9;

        this.root = this.scene.add
            .container(0, 0)
            .setDepth(9000)
            .setScrollFactor(0);
        this.root.setVisible(false);

        // lớp chặn click phía dưới
        this.blocker = this.scene.add
            .rectangle(0, 0, w, h, 0x000000, 0.0)
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setInteractive(); // chặn input xuống dưới

        this.root.add(this.blocker);

        // panel container
        this.panel = this.scene.add.container(0, 0).setScrollFactor(0);
        this.panelBg = this.scene.add.graphics().setScrollFactor(0);

        this.panel.add(this.panelBg);
        this.root.add(this.panel);

        this.resultGfx = this.scene.add.graphics().setScrollFactor(0);
        this.drawGfx = this.scene.add.graphics().setScrollFactor(0);
        this.root.add(this.resultGfx);
        this.root.add(this.drawGfx);

        // input vẽ lên panel
        this.blocker.on('pointerdown', (p: Phaser.Input.Pointer) =>
            this.onDown(p)
        );
        this.blocker.on('pointermove', (p: Phaser.Input.Pointer) =>
            this.onMove(p)
        );
        this.blocker.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
        this.blocker.on('pointerupoutside', (p: Phaser.Input.Pointer) =>
            this.onUp(p)
        );
    }

    // trả về toạ độ và kích thước panel trong world-space
    public getPanelRectWorld() {
        const px = this.panel?.x ?? this.panelX;
        const py = this.panel?.y ?? this.panelY;

        return {
            x: px,
            y: py,
            w: this.panelW,
            h: this.panelH,
            left: px - this.panelW / 2,
            right: px + this.panelW / 2,
            top: py - this.panelH / 2,
            bottom: py + this.panelH / 2,
        };
    }

    public show(opts: CircleCheckOverlayOptions) {
        if (
            !this.root ||
            !this.panel ||
            !this.panelBg ||
            !this.drawGfx ||
            !this.resultGfx
        )
            return;

        this.expectedCount = opts.expectedCount;
        this.onSuccess = opts.onSuccess;

        const w = this.scene.scale.width;
        const h = this.scene.scale.height;

        // ✅ bố cục ngang: [ bé 1 phần ] [ panel 4 phần ]
        const totalW = w * 0.96; // dùng gần full ngang
        const avatarColW = totalW * 0.2; // 1 phần
        this.panelW = totalW * 0.8; // 3 phần
        this.panelH = h * 0.72;

        const leftStart = (w - totalW) / 2;
        this.panelX = leftStart + avatarColW + this.panelW / 2; // ✅ panel nằm bên phải
        this.panelY = h * 0.52; // giữa màn

        // reset
        this.clearDraw();
        this.clearItems();

        // vẽ panel
        this.panelBg.clear();
        this.panelBg.fillStyle(0xffffff, 1);
        this.panelBg.lineStyle(6, 0x0084ff, 1);

        const x0 = -this.panelW / 2;
        const y0 = -this.panelH / 2;
        this.panelBg.fillRoundedRect(x0, y0, this.panelW, this.panelH, 24);
        this.panelBg.strokeRoundedRect(x0, y0, this.panelW, this.panelH, 24);

        // đặt panel ban đầu ở trên rồi rơi xuống
        this.panel.setPosition(this.panelX, -this.panelH);
        this.root.setVisible(true);

        // ===================== AUTO LAYOUT 14 ITEMS / 3 ROWS =====================
        const rawItems = (opts.items ?? []).slice(0, this.maxItems);

        const positions = this.layoutPositions(
            rawItems.length,
            this.rows,
            this.panelW,
            this.panelH
        );

        for (let i = 0; i < rawItems.length; i++) {
            const it = rawItems[i];
            const pos = positions[i];

            const spr = this.scene.add
                .image(x0 + pos.x, y0 + pos.y, it.key)
                .setOrigin(0.5)
                .setScale(it.scale ?? this.autoScaleByPanel())
                .setScrollFactor(0);

            this.itemsSprites.push(spr);
            this.panel.add(spr);
        }
        this.startItemsBobbing();
        // =======================================================================

        // drop animation
        this.scene.tweens.add({
            targets: this.panel,
            y: this.panelY,
            duration: 450,
            ease: 'Back.Out',
            onComplete: () => {
                if (opts.promptKey) this.playVoiceSafe(opts.promptKey);
            },
        });

        // lưu 2 key này để onUp dùng luôn
        (this as any)._successKey =
            opts.successKey ?? 'correct_quantity_circle';
        (this as any)._failKey = opts.failKey ?? 'voice_try_again_circel';
    }

    public hide() {
        if (!this.root) return;
        this.stopItemsBobbing(); // ✅ thêm
        this.root.setVisible(false);
        this.clearDraw();
        this.clearItems();
    }

    // ================= Layout =================

    /** trả về toạ độ trong panel-space (0..panelW, 0..panelH), đã căn giữa theo hàng */
    private layoutPositions(
        count: number,
        rows: number,
        panelW: number,
        panelH: number
    ) {
        const out: { x: number; y: number }[] = [];
        if (count <= 0) return out;

        // 14 & 3 -> maxCols = 5 -> rowCounts = [5,5,4]
        const maxCols = Math.ceil(count / rows);
        const rowCounts: number[] = [];
        let remain = count;
        for (let r = 0; r < rows; r++) {
            const n = Math.min(maxCols, remain);
            rowCounts.push(n);
            remain -= n;
        }

        const padX = panelW * 0.1;
        const padY = panelH * 0.22;
        const usableW = Math.max(10, panelW - padX * 2);
        const usableH = Math.max(10, panelH - padY * 2);

        const gapX = maxCols <= 1 ? 0 : usableW / (maxCols - 1);
        const gapY = rows <= 1 ? 0 : (usableH / (rows - 1)) * 0.9;

        const centerX = panelW / 2;

        for (let r = 0; r < rows; r++) {
            const n = rowCounts[r];
            if (n <= 0) continue;

            const y = padY + r * gapY;

            // căn giữa theo hàng: startX dựa theo n (không phải maxCols)
            const startX = centerX - ((n - 1) * gapX) / 2;

            for (let c = 0; c < n; c++) {
                out.push({
                    x: startX + c * gapX,
                    y,
                });
            }
        }

        return out;
    }

    // scale tương đối theo panel cho dễ nhìn (bạn chỉnh tuỳ)
    private autoScaleByPanel() {
        // scale tương đối theo panel cho dễ nhìn (bạn chỉnh tuỳ)
        // nhỏ màn hình -> scale nhỏ
        return Math.max(
            0.22,
            Math.min(0.36, this.panelH / (this.scene.scale.height * 0.9))
        );
    }

    // ================= Drawing =================

    // ngưỡng “kín” theo kích thước panel (tăng/giảm tuỳ bạn)
    private getCloseThresholdPx() {
        // ngưỡng “kín” theo kích thước panel (tăng/giảm tuỳ bạn)
        return Math.max(28, Math.min(this.panelW, this.panelH) * 0.08);
    }

    // kiểm tra nét vẽ có “kín” không
    private isStrokeClosed(points: Phaser.Math.Vector2[]) {
        if (points.length < 12) return false;

        const last = points[points.length - 1];
        const thr = this.getCloseThresholdPx();

        // 1) gần điểm đầu -> coi là kín
        const first = points[0];
        if (
            Phaser.Math.Distance.Between(first.x, first.y, last.x, last.y) <=
            thr
        )
            return true;

        // 2) hoặc “chạm lại” vào nét đã vẽ trước đó (không cần đúng điểm đầu)
        // bỏ qua vài điểm cuối để tránh tự dính vào chính nó khi vừa nhấc bút
        for (let i = 0; i < points.length - 8; i++) {
            const p = points[i];
            if (Phaser.Math.Distance.Between(p.x, p.y, last.x, last.y) <= thr)
                return true;
        }

        return false;
    }

    // tính diện tích polygon từ list điểm
    private polygonAreaFromPoints(points: Phaser.Math.Vector2[]) {
        // Shoelace, dùng list điểm (không cần Phaser.Area)
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y - points[j].x * points[i].y;
        }
        return Math.abs(area) * 0.5;
    }

    //item chổi bắt đầu nhấp nhô
    private startItemsBobbing() {
        // dọn tween cũ nếu có
        this.stopItemsBobbing();

        for (const spr of this.itemsSprites) {
            const baseY = spr.y;
            const baseS = spr.scaleX;

            const t = this.scene.tweens.add({
                targets: spr,
                y: baseY - Phaser.Math.Between(6, 12), // nhấp nhô lên 6~12px
                scaleX: baseS * Phaser.Math.FloatBetween(1.02, 1.06),
                scaleY: baseS * Phaser.Math.FloatBetween(1.02, 1.06),
                duration: Phaser.Math.Between(650, 1100),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.inOut',
                delay: Phaser.Math.Between(0, 300), // lệch pha cho tự nhiên
            });

            this.itemTweens.push(t);
        }
    }
    //dừng nhấp nhô
    private stopItemsBobbing() {
        for (const t of this.itemTweens) t?.stop();
        this.itemTweens = [];
        if (this.itemsSprites.length)
            this.scene.tweens.killTweensOf(this.itemsSprites);
    }

    // lấy rect panel trong world-space
    private panelWorldRect() {
        const px = this.panel?.x ?? this.panelX;
        const py = this.panel?.y ?? this.panelY;

        return {
            left: px - this.panelW / 2,
            right: px + this.panelW / 2,
            top: py - this.panelH / 2,
            bottom: py + this.panelH / 2,
        };
    }

    // kiểm tra toạ độ có trong panel không
    private isInsidePanel(worldX: number, worldY: number) {
        const r = this.panelWorldRect();
        return (
            worldX >= r.left &&
            worldX <= r.right &&
            worldY >= r.top &&
            worldY <= r.bottom
        );
    }

    // sự kiện input vẽ
    private onDown(p: Phaser.Input.Pointer) {
        if (!this.root?.visible) return;
        if (!this.isInsidePanel(p.x, p.y)) return;

        this.drawing = true;
        this.points = [new Phaser.Math.Vector2(p.x, p.y)];
        this.redrawStroke();
    }

    // sự kiện input vẽ (di chuyển)
    private onMove(p: Phaser.Input.Pointer) {
        if (!this.root?.visible) return;
        if (!this.drawing) return;
        if (!this.isInsidePanel(p.x, p.y)) return;

        const last = this.points[this.points.length - 1];
        const dx = p.x - last.x;
        const dy = p.y - last.y;
        if (dx * dx + dy * dy < 36) return; // lọc nhiễu ~6px (dễ vẽ hơn)

        this.points.push(new Phaser.Math.Vector2(p.x, p.y));
        this.redrawStroke();
    }

    // sự kiện input vẽ (nhấc bút)
    private onUp(_p: Phaser.Input.Pointer) {
        if (!this.root?.visible) return;
        if (!this.drawing) return;

        this.drawing = false;

        if (this.points.length < 12) {
            this.clearDraw();
            return;
        }

        // ✅ BẮT BUỘC “KÍN” trước, rồi mới tính đúng/sai
        const closed = this.isStrokeClosed(this.points);
        if (!closed) {
            const failKey = (this as any)._failKey as string;
            if (!this.playVoiceSafe(failKey))
                this.audio?.play?.('sfx-wrong', { volume: 0.05 });

            // không cho tính polygon, xoá để vẽ lại
            this.scene.time.delayedCall(350, () => this.clearDraw());
            return;
        }

        // ✅ tạo polygon: đóng vòng bằng cách nối về điểm đầu
        const ptsFlat: number[] = [];
        for (const v of this.points) ptsFlat.push(v.x, v.y);
        ptsFlat.push(this.points[0].x, this.points[0].y);
        const poly = new Phaser.Geom.Polygon(ptsFlat);

        // ✅ chống khoanh quá nhỏ
        const minArea = this.panelW * this.panelH * 0.02; // 2% panel
        const area = this.polygonAreaFromPoints(this.points);
        if (area < minArea) {
            const failKey = (this as any)._failKey as string;
            if (!this.playVoiceSafe(failKey))
                this.audio?.play?.('sfx-wrong', { volume: 0.05 });
            this.scene.time.delayedCall(350, () => this.clearDraw());
            return;
        }

        // ✅ đếm số item nằm trong polygon
        let count = 0;
        for (const spr of this.itemsSprites) {
            const m = spr.getWorldTransformMatrix();
            const wx = m.tx;
            const wy = m.ty;
            if (Phaser.Geom.Polygon.Contains(poly, wx, wy)) count++;
        }

        // ✅ CHỈ ĐÚNG KHI: “kín” + đúng số lượng
        const isCorrect = count === this.expectedCount;

        this.paintResult(poly, isCorrect);

        const successKey = (this as any)._successKey as string;
        const failKey = (this as any)._failKey as string;

        if (isCorrect) {
            // ✅ phát khen xong mới hide + onSuccess
            const played = this.playVoiceSafe(successKey, () => {
                this.scene.time.delayedCall(120, () => {
                    this.hide();
                    this.onSuccess?.();
                });
            });

            // fallback nếu không có voice khen
            if (!played) {
                this.audio?.play?.('sfx-correct', { volume: 0.9 });
                this.scene.time.delayedCall(450, () => {
                    this.hide();
                    this.onSuccess?.();
                });
            }
        } else {
            // ✅ phát "thử lại" xong mới clear nét
            const played = this.playVoiceSafe(failKey, () => {
                this.scene.time.delayedCall(120, () => this.clearDraw());
            });

            if (!played) {
                this.audio?.play?.('sfx-wrong', { volume: 0.05 });
                this.scene.time.delayedCall(450, () => this.clearDraw());
            }
        }
    }

    // vẽ lại nét vẽ
    private redrawStroke() {
        if (!this.drawGfx) return;

        this.drawGfx.clear();
        this.drawGfx.lineStyle(12, 0x7c4dff, 0.95); // dày hơn cho dễ “kín”
        this.drawGfx.beginPath();

        const p0 = this.points[0];
        this.drawGfx.moveTo(p0.x, p0.y);
        for (let i = 1; i < this.points.length; i++) {
            const p = this.points[i];
            this.drawGfx.lineTo(p.x, p.y);
        }
        this.drawGfx.strokePath();
    }

    // tô vùng khoanh (xanh/đỏ)
    private paintResult(poly: Phaser.Geom.Polygon, isCorrect: boolean) {
        if (!this.resultGfx) return;

        this.resultGfx.clear();
        const color = isCorrect ? 0x00c853 : 0xff4d4d;

        this.resultGfx.fillStyle(color, 0.25);
        this.resultGfx.lineStyle(8, color, 0.9);

        const pts = poly.points;
        if (!pts || pts.length < 3) return;

        this.resultGfx.beginPath();
        this.resultGfx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            this.resultGfx.lineTo(pts[i].x, pts[i].y);
        }
        this.resultGfx.closePath();
        this.resultGfx.fillPath();
        this.resultGfx.strokePath();
    }

    // phát voice an toàn (kiểm tra tồn tại key)
    private playVoiceSafe(key: string, onDone?: () => void) {
        if (!key) {
            onDone?.();
            return false;
        }

        if (this.audio?.has?.(key)) {
            // Nếu hệ HowlerAudioManager của bạn hỗ trợ callback:
            // playFeedback(key, onDone)
            this.audio.playFeedback?.(key, onDone);
            return true;
        }

        onDone?.();
        return false;
    }


    private clearDraw() {
        this.points = [];
        this.drawGfx?.clear();
        this.resultGfx?.clear();
    }

    private clearItems() {
        this.stopItemsBobbing(); // ✅ thêm (an toàn)
        for (const s of this.itemsSprites) s.destroy();
        this.itemsSprites = [];
    }
}
