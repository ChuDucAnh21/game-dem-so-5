import Phaser from 'phaser';
import { showGameButtons } from '../main';
import type { CountLevel } from '../game/quantity/quantityTypes';
import { buildQuantityLevels } from '../game/quantity/quantityLevels';
import { HowlerAudioManager } from '../assets/howler-manager/HowlerAudioManager';
import { QUANTITY_SOUNDS, QUANTITY_IMAGES } from '../assets/quantityAssets';
import { initRotateOrientation } from '../rotateOrientation';
import { playVoiceLocked } from '../rotateOrientation';
import { CircleCheckOverlay } from '../components/game/CircleCheckOverlay';

export class QuantityScene extends Phaser.Scene {
    //biến nhớ để xem cái nào bị ẩn
    private overlayHidden: Phaser.GameObjects.GameObject[] = [];

    private audioReady = false; // ✅ thêm dòng này
    private forcePrompt = false;
    init(data: any) {
        if (data?.audio) this.audio = data.audio;
        this.audioReady = !!data?.audioReady; // ✅ thêm dòng này
        this.forcePrompt = !!data?.forcePrompt;
    }
    private audio!: HowlerAudioManager;
    // brush cho tô
    private brushRadius = 24; // to hơn cho dễ tô tròn

    private brushColor = 0xb388ff; // xanh dương cho bé
    private fillThreshold = 0.9; // 60% là đạt (dễ thở hơn)
    private paintGridSize = 10; // lưới 16x16 điểm mẫu cho mỗi vòng

    private currentLevelIndex = 0;
    private levels: CountLevel[] = [];

    private score = 0;

    avata_child!: Phaser.GameObjects.Image;

    private bgLayerA: HTMLElement | null = null;
    private bgLayerB: HTMLElement | null = null;
    private isBgAActive = true;

    private bgByIcon: Record<string, string> = {
        candle: 'assets/images/bg/bg_garden.jpg',
    };

    //màn hình khoanh
    private circleOverlay!: CircleCheckOverlay;

    private overlayBobTween?: Phaser.Tweens.Tween;

    // UI

    private doneButton!: Phaser.GameObjects.Container;
    private titleBanner!: Phaser.GameObjects.Image;
    // ✅ icon check đúng/sai
    private checkIcon?: Phaser.GameObjects.Image;

    private initialPromptPlayed = false;

    // objects & circles
    private objectSprites: Phaser.GameObjects.Image[] = [];
    private circleSprites: Phaser.GameObjects.Image[] = [];

    // label số đếm dưới mỗi vật
    private countLabels: Phaser.GameObjects.Text[] = [];

    // 👉 hint tô
    private hintFinger?: Phaser.GameObjects.Image;
    private hintPaint?: Phaser.GameObjects.Graphics;

    // chỉ cần phân biệt đang trong game hay đã end
    // playing: đang làm
    // checking: đang chấm / phát voice, KHÔNG cho ấn nút
    // result: màn tổng kết
    private state: 'playing' | 'checking' | 'result' = 'playing';

    private titleText?: Phaser.GameObjects.Text;
    private avatarFloatTween?: Phaser.Tweens.Tween;
    private overlayBubble?: Phaser.GameObjects.Container;
    private overlayAvatarBase?: { x: number; y: number; scale: number };
    

    constructor() {
        // Đảm bảo key này trùng với key bạn dùng trong config game
        super('QuantityScene');
    }

    // ========= Helper =========

    private getW() {
        return this.scale.width;
    }
    private getH() {
        return this.scale.height;
    }
    private pctX(p: number) {
        return this.getW() * p;
    }
    private pctY(p: number) {
        return this.getH() * p;
    }

    private stopAllVoices() {
        this.audio.stopAllVoices();
    }
    // 🔥 tô xanh lá các vòng tròn đã tô đúng
    private highlightCorrectCirclesGreen() {
        for (const circle of this.circleSprites) {
            const ratio = this.getCircleFillRatio(circle);

            // chỉ đổi màu những vòng đạt điều kiện đúng
            if (ratio >= this.fillThreshold) {
                const paintGfx = circle.getData(
                    'paintGfx'
                ) as Phaser.GameObjects.Graphics;
                if (!paintGfx) continue;

                // Xoá nét tô cũ (xanh dương)
                paintGfx.clear();

                // Tô full vòng với màu xanh lá
                const radius = (circle.displayWidth / 2) * 0.93;
                paintGfx.fillStyle(0x00c853, 0.95); // xanh lá tươi
                paintGfx.fillCircle(circle.x, circle.y, radius);
            }
        }
    }
    // Tạo hint: vệt tô mờ + ngón tay trên 1 vòng tròn
    private showPaintHintForCircle(circle: Phaser.GameObjects.Image) {
        // vệt tô mờ
        const hintPaint = this.add.graphics().setDepth(4).setAlpha(0.4);
        const radius = (circle.displayWidth / 2) * 0.7;

        hintPaint.fillStyle(this.brushColor, 1);
        hintPaint.fillCircle(circle.x, circle.y, radius);

        // dùng chung mask với vòng tròn để vệt tô không tràn ra ngoài
        const existingMask = circle.getData(
            'mask'
        ) as Phaser.Display.Masks.GeometryMask | null;
        if (existingMask) {
            hintPaint.setMask(existingMask);
        }

        this.hintPaint = hintPaint;

        // ngón tay
        const finger = this.add
            .image(
                circle.x + radius * 1.2,
                circle.y - radius * 0.1,
                'hint_finger'
            )
            .setDepth(5)
            .setAlpha(0.95)
            .setScale(0.5);

        this.hintFinger = finger;

        // tween cho ngón tay “chạm nhẹ”
        this.tweens.add({
            targets: finger,
            y: finger.y + 64,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut',
        });
    }

    // Xoá hint khi bé bắt đầu tô đúng vòng
    private hidePaintHint() {
        if (this.hintPaint) {
            this.hintPaint.destroy();
            this.hintPaint = undefined;
        }
        if (this.hintFinger) {
            this.hintFinger.destroy();
            this.hintFinger = undefined;
        }
    }

    // ========= Preload =========

    preload() {
        // load các ảnh từ file quanlityAsset
        for (const it of QUANTITY_IMAGES) {
            this.load.image(it.key, it.url);
        }
    }

    // ========= Create =========

    async create() {
        // chờ font load
        await (document as any).fonts?.ready;

        // hoặc ép load đúng cỡ chữ bạn dùng:
        await (document as any).fonts?.load(
            `700 ${Math.round(this.getH() * 0.038)}px "Baloo 2"`
        );

        if (!this.audio) {
            this.audio = new HowlerAudioManager(QUANTITY_SOUNDS);
        }

        this.circleOverlay = new CircleCheckOverlay(this, this.audio);
        this.circleOverlay.init();

        // cho nút reload ngoài DOM bắn vào
        (window as any).quantityScene = this;
        (window as any).compareScene = this;

        // background DOM
        this.bgLayerA = document.getElementById('bg-layer-a');
        this.bgLayerB = document.getElementById('bg-layer-b');

        if (this.bgLayerA) {
            this.bgLayerA.style.backgroundImage =
                "url('assets/images/bg/bg_home.png')";
            this.bgLayerA.classList.add('visible');
            this.isBgAActive = true;
        }
        if (this.bgLayerB) {
            this.bgLayerB.style.backgroundImage =
                "url('assets/images/bg/bg_lake.png')";
            this.bgLayerB.classList.remove('visible');
        }

        // Bé
        this.avata_child = this.add
            .image(this.pctX(0), this.pctY(0.65), 'avata_child')
            .setOrigin(0, 1);
        this.avata_child.setScale(0.5);
        this.avatarFloatTween = this.tweens.add({
            targets: this.avata_child,
            y: this.avata_child.y - 10,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut',
        });
        // === Banner + Title cố định ===

        // Tạo banner trước
        const titleTex = this.textures.get('title_banner').getSourceImage() as
            | HTMLImageElement
            | HTMLCanvasElement;

        const titleTargetWidth = this.getW() * 0.8; // chiếm ~85% chiều ngang
        const titleScale = titleTargetWidth / titleTex.width;
        const scaleYFactor = 0.75; // <-- giảm chiều cao (0.6~0.85 tuỳ thích)

        this.titleBanner = this.add
            .image(this.pctX(0.5), this.pctY(0.11), 'title_banner')
            .setOrigin(0.5)
            .setScale(titleScale, titleScale * scaleYFactor)
            .setDepth(900); // dưới text, trên background

        // Text nằm TRONG panel_title, trùng tâm với banner
        this.titleText = this.add
            .text(
                Math.round(this.titleBanner.x),
                Math.round(this.titleBanner.y),
                'BÉ ĐẾM ĐỒ VẬT VÀ TÔ SỐ VÒNG TƯƠNG ỨNG',
                {
                    fontFamily: '"Baloo 2", sans-serif',
                    fontSize: `${Math.round(this.getH() * 0.054)}px`,
                    color: '#ffffff',
                    align: 'bottom',
                    stroke: '#0b3a66',
                    strokeThickness: 2,
                    fontStyle: '700',
                    letterSpacing: 1.0,
                    wordWrap: {
                        width: this.titleBanner.displayWidth * 0.9, // wrap trong panel
                        useAdvancedWrap: true,
                    },
                    padding: { top: 10, bottom: 10, left: 6, right: 6 }, // ✅ CHỐNG CẮT DẤU
                }
            )
            .setOrigin(0.5)
            .setDepth(this.titleBanner.depth + 1); // luôn trên banner

        // Nút Hoàn thành
        const btnWidth = this.getW() * 0.25;
        const btnHeight = this.getH() * 0.08;

        // Vẽ nền nút bằng Graphics để bo góc
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x1b6cff, 1); // xanh dương
        btnBg.fillRoundedRect(
            -btnWidth / 2,
            -btnHeight / 2,
            btnWidth,
            btnHeight,
            24
        );

        const btnLabel = this.add.text(0, 0, 'KIỂM TRA', {
            fontFamily: '"Baloo 2", sans-serif',
            fontSize: `${Math.round(this.getH() * 0.044)}px`,
            color: '#ffffff', // chữ trắng
            align: 'center',
            fontStyle: '700',
            stroke: '#0b3a66',
            strokeThickness: 2,
            letterSpacing: 1,
            wordWrap: {
                width: this.titleBanner.displayWidth * 0.2, // wrap trong panel
                useAdvancedWrap: true,
            },
            padding: { top: 10, bottom: 10, left: 6, right: 6 }, // ✅ CHỐNG CẮT DẤU
        });
        btnLabel.setOrigin(0.5);

        this.doneButton = this.add
            .container(this.pctX(0.5), this.pctY(0.88), [btnBg, btnLabel])
            .setSize(btnWidth, btnHeight)
            .setDepth(10);

        this.doneButton.setInteractive({ useHandCursor: true });
        // 🌟 Idle animation: nút "thở" nhẹ cho bé thấy nổi bật
        const idleTween = this.tweens.add({
            targets: this.doneButton,
            scaleX: 1.03,
            scaleY: 1.03,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut',
        });

        // 🖱 Hover / focus (web + chuột): phóng to nhẹ
        this.doneButton.on('pointerover', () => {
            idleTween.pause(); // tạm dừng idle để không giật
            this.tweens.add({
                targets: this.doneButton,
                scaleX: 1.08,
                scaleY: 1.08,
                duration: 150,
                ease: 'Back.Out',
            });
        });

        this.doneButton.on('pointerout', () => {
            this.tweens.add({
                targets: this.doneButton,
                scaleX: 1,
                scaleY: 1,
                duration: 150,
                ease: 'Back.Out',
                onComplete: () => {
                    idleTween.restart(); // cho idle chạy lại
                },
            });
        });

        // 👆 animation nhấn: hơi “lún” xuống rồi bật lại
        this.doneButton.on('pointerdown', () => {
            if (this.state !== 'playing') return; // tránh spam khi đang checking/result

            this.tweens.add({
                targets: this.doneButton,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 80,
                yoyo: true,
                ease: 'Sine.inOut',
            });

            this.handleDonePressed();
        });

        // Panel trắng chứa đồ vật (dùng Graphics để co giãn theo số lượng)
        this.objectsPanel = this.add.graphics().setDepth(1);
        this.panelBounds.centerX = this.pctX(0.5);
        this.panelBounds.centerY = this.pctY(0.4);

        // Levels
        this.levels = this.buildLevels();
        this.currentLevelIndex = 0;
        this.score = 0;
        this.state = 'playing';

        this.showCurrentLevel();
        initRotateOrientation({ audio: this.audio });

        // ✅ Nếu audio đã sẵn sàng (từ EndGameScene “Chơi lại”) → không gắn click để phát lại prompt
        if (!this.audioReady) {
            this.input.once('pointerdown', async () => {
                await Promise.resolve(this.audio.unlock?.());

                const shouldShowRotate =
                    window.innerHeight > window.innerWidth &&
                    window.innerWidth < 768;

                if (shouldShowRotate) {
                    playVoiceLocked(this.audio, 'voice_rotate');
                    return;
                }

                // ✅ BGM luôn phát sau unlock
                this.audio.playBgm('bgm_quantity');

                // ✅ Prompt chỉ phát đúng 1 lần
                if (!this.initialPromptPlayed) {
                    this.initialPromptPlayed = true;
                    const lvl = this.levels[this.currentLevelIndex];
                    this.playPromptForLevel(lvl);
                }

                // ✅ sau unlock thì coi như audioReady
                this.audioReady = true;
            });
        } else {
            this.audio.playBgm('bgm_quantity');
        }

        showGameButtons();
        // ✅ nếu được yêu cầu force prompt (reset) thì phát lại prompt level 0
        if (this.forcePrompt && this.audioReady) {
            this.time.delayedCall(0, () => {
                const lvl = this.levels[this.currentLevelIndex];
                this.playPromptForLevel(lvl);
            });
        }
    }

    // ========= Game logic =========
    private updateObjectsPanel() {
        const centerX = this.pctX(0.5);
        const centerY = this.pctY(0.4);

        // ✅ Panel cố định, KHÔNG phụ thuộc số lượng vật
        const panelWidth = this.getW() * 0.5;
        const panelHeight = this.getH() * 0.41;

        this.panelBounds = {
            centerX,
            centerY,
            width: panelWidth,
            height: panelHeight,
        };

        this.objectsPanel.clear();

        const x = centerX - panelWidth / 2;
        const y = centerY - panelHeight / 2;
        const radius = 24;

        this.objectsPanel.lineStyle(6, 0x0084ff, 1);
        this.objectsPanel.fillStyle(0xffffff, 1);

        this.objectsPanel.strokeRoundedRect(
            x,
            y,
            panelWidth,
            panelHeight,
            radius
        );
        this.objectsPanel.fillRoundedRect(
            x,
            y,
            panelWidth,
            panelHeight,
            radius
        );
    }

    private buildLevels(): CountLevel[] {
        return buildQuantityLevels();
    }

    // trước đây: private setBackgroundForIcon(icon: string)
    private setBackgroundForIcon(iconKeys: string[]) {
        if (!iconKeys || iconKeys.length === 0) return;

        const mainKey = iconKeys[0]; // dùng icon đầu tiên trong mảng
        const url = this.bgByIcon[mainKey] ?? 'assets/images/bg/bg_home.png';

        if (!this.bgLayerA || !this.bgLayerB) return;

        const active = this.isBgAActive ? this.bgLayerA : this.bgLayerB;
        const hidden = this.isBgAActive ? this.bgLayerB : this.bgLayerA;

        const currentBg = active.style.backgroundImage;
        const targetBg = `url("${url}")`;
        if (currentBg === targetBg) return;

        hidden.style.backgroundImage = `url('${url}')`;
        hidden.classList.add('visible');
        active.classList.remove('visible');

        this.isBgAActive = !this.isBgAActive;
    }

    // Phát prompt cho level hiện tại
    private playPromptForLevel(level: CountLevel) {
        if (!level.promptKey) return;
        this.audio.playPrompt(level.promptKey);
    }

    // Ẩn/hiện toàn bộ gameplay (dưới overlay)
    private setGameplayVisible(visible: boolean) {
        // Ẩn thật toàn bộ gameplay (nhưng không đụng DOM background)
        this.objectsPanel?.setVisible(visible);
        this.objectSprites.forEach((s) => s.setVisible(visible));
        this.circleSprites.forEach((s) => s.setVisible(visible));
        this.countLabels.forEach((t) => t.setVisible(visible));
        this.checkIcon?.setVisible(visible);

        this.doneButton?.setVisible(visible);
        this.titleBanner?.setVisible(visible);
        this.titleText?.setVisible(visible);

        if (!visible) this.hidePaintHint();
    }

    //Tạo bong bóng chát của bé cho màn 2
    private createSpeechBubbleNearAvatar(text: string) {
        this.overlayBubble?.destroy();

        const wrapW = this.getW() * 0.9;

        const bubbleText = this.add
            .text(0, 0, text, {
                fontFamily: '"Baloo 2", sans-serif',
                fontSize: `${Math.round(this.getH() * 0.048)}px`,
                color: '#ffffffff',
                fontStyle: '700',
                align: 'center',
                wordWrap: { width: wrapW, useAdvancedWrap: true },
                padding: { left: 18, right: 18, top: 0, bottom: 0 },
            })
            .setOrigin(0.5);

        const bw = bubbleText.width + 55;
        const bh = bubbleText.height + 30;
        const radius = 22;

        // ✅ style bubble
        const BORDER_W = 1; // 👈 viền mỏng hơn (tự chỉnh 3~5)
        const BORDER_COLOR = 0x00c853; // 👈 xanh lá viền
        const BG_COLOR = 0x00c853; // 👈 nền xanh lá nhạt

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.18);
        shadow.fillRoundedRect(-bw / 2 + 6, -bh / 2 + 8, bw, bh, radius);

        const bg = this.add.graphics();
        bg.fillStyle(BG_COLOR, 1);
        bg.lineStyle(BORDER_W, BORDER_COLOR, 1);
        bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, radius);
        bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, radius);

        // ===================== TAIL (ĐUÔI) =====================
        // ✅ CHỈNH ĐUÔI Ở ĐÂY (comment để bạn kéo cho chuẩn):
        // tailBaseX: dịch ngang điểm bám đuôi trên cạnh dưới bubble
        // tailBaseY: dịch dọc (thường = bh/2 - nhỏ)
        // tailW: độ rộng đuôi
        // tailH: độ cao đuôi (đâm xuống dưới)
        const tailBaseX = -bw / 2.1; // 👈 tăng -> đuôi dịch sang phải, giảm -> sang trái
        const tailBaseY = bh / 2 - 8; // 👈 tăng -> đuôi thấp hơn, giảm -> cao hơn
        const tailW = 100; // 👈 độ rộng đuôi
        const tailH = 28; // 👈 độ cao đuôi

        // Đuôi chéo sang TRÁI (mũi lệch trái)
        bg.fillStyle(BG_COLOR, 1);
        bg.lineStyle(BORDER_W, BORDER_COLOR, 1);
        bg.beginPath();

        const tipShift = -tailW * 0.48;
        // 👆 âm = chéo sang trái mạnh hơn, ví dụ: -0.25..-0.55

        bg.moveTo(tailBaseX, tailBaseY); // chân trái đuôi
        bg.lineTo(
            tailBaseX + tailW * 0.45 + tipShift, // mũi đuôi bị kéo sang trái
            tailBaseY + tailH
        );
        bg.lineTo(tailBaseX + tailW, tailBaseY); // chân phải đuôi

        bg.closePath();
        bg.fillPath();
        bg.strokePath();

        // =======================================================

        const c = this.add
            .container(0, 0, [shadow, bg, bubbleText])
            .setDepth(5205);
        this.overlayBubble = c;

        c.setScale(0.85); // 👈 nhỏ lúc đầu để pop-in
        this.tweens.add({
            targets: c,
            scale: 1, // 👈 scale đều X=Y
            duration: 220,
            ease: 'Back.Out',
        });
    }

    // Bé bay vào vị trí bên cạnh overlay circle + tạo bubble
    private enterCircleOverlay(expectedCount: number) {
        this.hideAllUnderOverlay();

        // dừng bob cũ (màn 1) để không giật khi tween bay
        this.avatarFloatTween?.pause();

        // nếu overlay bob còn tồn tại từ lần trước -> kill
        if (this.overlayBobTween) {
            this.overlayBobTween.stop();
            this.overlayBobTween.remove();
            this.overlayBobTween = undefined;
        }

        if (!this.overlayAvatarBase) {
            this.overlayAvatarBase = {
                x: this.avata_child.x,
                y: this.avata_child.y,
                scale: this.avata_child.scaleX,
            };
        }

        const w = this.getW();
        const h = this.getH();
        const r = this.circleOverlay.getPanelRectWorld();

        const targetScale = 0.50;
        const marginX = w * 0.13;

        // ✅ Bé góc trên-trái (ngoài panel)
        const avatarX = Phaser.Math.Clamp(
            r.left - w * 0.18,
            w * 0.0,
            r.left - marginX
        );
        const avatarY = Phaser.Math.Clamp(
            r.top + h * 0.18,
            h * 0.55,
            r.top + h * 0.28
        );

        this.tweens.killTweensOf(this.avata_child);
        this.avata_child.setDepth(9100);

        // tween bay tới vị trí
        this.tweens.add({
            targets: this.avata_child,
            x: avatarX,
            y: avatarY,
            duration: 380,
            ease: 'Sine.out',
            onComplete: () => {
                // ✅ bob overlay giống màn 1 (nhấp nhô)
                this.overlayBobTween = this.tweens.add({
                    targets: this.avata_child,
                    y: this.avata_child.y - 10,
                    duration: 800,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.inOut',
                });
            },
        });

        // tween scale
        this.tweens.add({
            targets: this.avata_child,
            scaleX: targetScale,
            scaleY: targetScale,
            duration: 240,
            ease: 'Sine.out',
        });

        // bubble
        const msg = `Bé khoanh nhóm ${expectedCount} chiếc chổi`;
        this.createSpeechBubbleNearAvatar(msg);

        const bubbleOffsetX = -0.9; // 👈 + sang phải, - sang trái
        const bubbleOffsetY = 0; // 👈 + xuống, - lên

        const bubbleX = r.left + r.w * 0.23 + bubbleOffsetX;
        const bubbleY = r.top - h * 0.07 + bubbleOffsetY;

        this.overlayBubble!.setDepth(9200);
        this.overlayBubble!.setPosition(bubbleX, bubbleY);
    }

    // Bé bay về vị trí cũ + xoá bubble
    private exitCircleOverlay() {
        this.overlayBubble?.destroy();
        this.overlayBubble = undefined;
        // ✅ trả mọi thứ bên dưới về lại
        this.restoreAllUnderOverlay();
        if (this.overlayAvatarBase) {
            this.tweens.killTweensOf(this.avata_child);
            this.tweens.add({
                targets: this.avata_child,
                x: this.overlayAvatarBase.x,
                y: this.overlayAvatarBase.y,
                scaleX: this.overlayAvatarBase.scale,
                scaleY: this.overlayAvatarBase.scale,
                duration: 420,
                ease: 'Sine.out',
                onComplete: () => {
                    this.avata_child.setDepth(2);
                    this.avatarFloatTween?.resume();
                },
            });
        } else {
            this.avatarFloatTween?.resume();
        }

        this.setGameplayVisible(true);
        // ✅ tắt bob overlay
        if (this.overlayBobTween) {
            this.overlayBobTween.stop();
            this.overlayBobTween.remove();
            this.overlayBobTween = undefined;
        }
    }

    //biến nhớ để xem cái nào bị ẩn
    private hideAllUnderOverlay() {
        this.overlayHidden = [];

        // hide mọi thứ có depth < 9000 (overlay root), trừ bé + bubble
        for (const obj of this.children
            .list as Phaser.GameObjects.GameObject[]) {
            if (!obj) continue;

            if (obj === this.avata_child) continue;
            if (this.overlayBubble && obj === this.overlayBubble) continue;

            const depth = (obj as any).depth ?? 0;
            if (depth < 9000 && (obj as any).visible !== false) {
                (obj as any).setVisible?.(false);
                this.overlayHidden.push(obj);
            }
        }
    }

    // khôi phục lại các object đã ẩn
    private restoreAllUnderOverlay() {
        for (const obj of this.overlayHidden) {
            (obj as any).setVisible?.(true);
        }
        this.overlayHidden = [];
    }

    // ========= Show level =========

    private showCurrentLevel() {
        const level = this.levels[this.currentLevelIndex];

        this.clearObjectsAndCircles();

        this.state = 'playing';

        this.setBackgroundForIcon(level.objectIcon);

        // 🔥 vẽ panel theo số lượng vật của level
        this.updateObjectsPanel();

        this.drawObjects(level);
        this.drawCircles(level);

        // ✅ Chỉ auto phát prompt khi audioReady (tức đã unlock từ trước)
        // ✅ Nếu chưa unlock: prompt sẽ chỉ phát trong pointerdown unlock (1 lần)
        if (this.audioReady) {
            this.playPromptForLevel(level);
        }
        this.animateLevelIntro();
    }

    // Xoá hết vật và vòng tròn cũ
    private clearObjectsAndCircles() {
        this.objectSprites.forEach((s) => s.destroy());
        this.circleSprites.forEach((s) => s.destroy());

        this.objectSprites = [];
        this.circleSprites = [];

        // xoá label số nếu có
        this.countLabels.forEach((t) => t.destroy());
        this.countLabels = [];

        // xoá icon check nếu có
        if (this.checkIcon) {
            this.checkIcon.destroy();
            this.checkIcon = undefined;
        }
    }

    // Tính scale để vật vừa trong ô
    private getScaleForTexture(
        textureKey: string,
        maxWidth: number,
        maxHeight: number
    ) {
        const tex = this.textures.get(textureKey);
        const source = tex.getSourceImage() as
            | HTMLImageElement
            | HTMLCanvasElement;

        const texW = source.width || 1;
        const texH = source.height || 1;

        const scaleX = (maxWidth * 0.85) / texW;
        const scaleY = (maxHeight * 0.85) / texH;

        return Math.min(scaleX, scaleY);
    }

    private objectsPanel!: Phaser.GameObjects.Graphics;
    private panelBounds = { centerX: 0, centerY: 0, width: 0, height: 0 };

    // Vẽ đồ vật theo số lượng của level
    private drawObjects(level: CountLevel) {
        const count = level.objectCount;
        if (count <= 0) return;

        const centerX = this.panelBounds.centerX || this.pctX(0.5);
        const centerY = this.panelBounds.centerY || this.pctY(0.9);
        const panelW = this.panelBounds.width || this.getW() * 0.8;
        const panelH = this.panelBounds.height || this.getH() * 0.36;

        // vùng khả dụng để đặt vật
        const paddingX = this.getW() * 0.045;
        const availableWidth = Math.max(
            panelW - paddingX * 4,
            this.getW() * 0.4
        );

        // ✅ chia slot theo số lượng vật
        const slotWidth = availableWidth / count;

        // ✅ mỗi vật chiếm 70% slot → nhiều vật thì slot nhỏ, vật tự nhỏ lại
        const maxObjWidth = slotWidth * 0.9;
        const maxObjHeight = panelH * 0.7;

        const startX = centerX - availableWidth / 2 + slotWidth / 2;

        const iconPool =
            level.objectIcon && level.objectIcon.length > 0
                ? level.objectIcon
                : ['hustle'];

        this.objectSprites = [];

        for (let i = 0; i < count; i++) {
            const x = startX + i * slotWidth;
            const y = centerY - panelH * 0.06;

            const iconKey = Phaser.Utils.Array.GetRandom
                ? Phaser.Utils.Array.GetRandom(iconPool)
                : iconPool[Math.floor(Math.random() * iconPool.length)];

            const sprite = this.add
                .image(x, y, iconKey)
                .setOrigin(0.5)
                .setDepth(2);

            const scale = this.getScaleForTexture(
                iconKey,
                maxObjWidth,
                maxObjHeight
            );
            sprite.setScale(scale);

            (sprite as any).baseScaleX = sprite.scaleX;
            (sprite as any).baseScaleY = sprite.scaleY;

            // ✅ lưu Y gốc để không bị trôi vị trí
            sprite.setData('baseY', y);

            sprite.setInteractive({ useHandCursor: true });
            sprite.on('pointerdown', () => {
                if (this.state === 'result') return;

                this.audio.play('sfx-click');

                const baseY = sprite.getData('baseY') as number;

                // ✅ dừng tween cũ + kéo về đúng vị trí gốc trước khi bounce lại
                this.tweens.killTweensOf(sprite);
                sprite.y = baseY;

                this.tweens.add({
                    targets: sprite,
                    y: baseY - 20, // ✅ luôn bounce theo baseY, không theo y hiện tại
                    duration: 120,
                    yoyo: true,
                    ease: 'Sine.out',
                    onComplete: () => {
                        // ✅ chốt lại đúng baseY (phòng trường hợp tween bị ngắt giữa chừng)
                        sprite.y = baseY;
                    },
                });
            });

            this.objectSprites.push(sprite);
        }
    }

    // Hiện số 1-2-3-... dưới mỗi đồ vật sau khi bé làm đúng
    private showCountNumbersForObjects(level: CountLevel) {
        this.countLabels.forEach((t) => t.destroy());
        this.countLabels = [];

        const count = level.objectCount;
        const maxIndex = Math.min(count, this.objectSprites.length);

        for (let i = 0; i < maxIndex; i++) {
            const sprite = this.objectSprites[i];

            const label = this.add
                .text(
                    sprite.x,
                    sprite.y + sprite.displayHeight / 2 + this.getH() * 0.007,
                    `${i + 1}`,
                    {
                        fontFamily: '"Baloo 2", sans-serif',
                        fontSize: `${Math.round(this.getH() * 0.06)}px`,
                        color: '#ffff00ff',
                        align: 'bottom',
                        stroke: '#000982ff',
                        strokeThickness: 2,
                        fontStyle: '700',
                        letterSpacing: 1.0,
                        wordWrap: {
                            width: this.titleBanner.displayWidth * 0.9, // wrap trong panel
                            useAdvancedWrap: true,
                        },
                        padding: { top: 10, bottom: 10, left: 6, right: 6 }, // ✅ CHỐNG CẮT DẤU
                    }
                )
                .setOrigin(0.5, 0)
                .setDepth(6);

            // pop-in nhẹ
            label.setScale(0.5);
            this.tweens.add({
                targets: label,
                scaleX: 1,
                scaleY: 1,
                duration: 220,
                ease: 'Back.Out',
            });

            this.countLabels.push(label);
        }
    }
    // Phát giọng đếm 1-2-3-... và scale từng đồ vật + số tương ứng
    private playCountingSequence(level: CountLevel, onDone: () => void) {
        const max = Math.min(level.objectCount, this.objectSprites.length);

        const step = (i: number) => {
            if (i >= max) {
                onDone();
                return;
            }

            const sprite = this.objectSprites[i];
            const label = this.countLabels[i];
            const voiceKey = `count_${i + 1}`;

            // Không có audio -> vẫn tween rồi next
            if (!this.audio.has(voiceKey)) {
                this.tweenCountTarget(sprite, label, () => step(i + 1));
                return;
            }

            // tween scale khi đọc số
            this.tweenCountTarget(sprite, label);

            // play và chờ end
            this.audio.play(voiceKey, {
                stopSame: true,
                onEnd: () => step(i + 1),
            });
        };

        step(0);
    }

    // Tween scale cho 1 đồ vật + label số tương ứng
    private tweenCountTarget(
        sprite: Phaser.GameObjects.Image,
        label?: Phaser.GameObjects.Text,
        onComplete?: () => void
    ) {
        const targets: any[] = [sprite];
        if (label) {
            targets.push(label);
        }

        this.tweens.add({
            targets,
            scaleX: (target: any) =>
                (target.baseScaleX || target.scaleX) * 1.15,
            scaleY: (target: any) =>
                (target.baseScaleY || target.scaleY) * 1.15,
            yoyo: true,
            duration: 260,
            ease: 'Back.Out',
            onComplete: () => {
                if (onComplete) onComplete();
            },
        });
    }

    // Vòng tròn – cho bé TÔ + sau này đếm tỷ lệ tô
    private drawCircles(level: CountLevel) {
        const maxCircles = 7;
        level.maxCircles = maxCircles;

        const centerX = this.pctX(0.5);
        const y = this.pctY(0.7);
        const areaWidth = this.getW() * 0.8;

        const spacing = (areaWidth * 0.7) / (maxCircles - 1);
        const startX = centerX - (spacing * (maxCircles - 1)) / 2;

        const tex = this.textures.get('circle_empty').getSourceImage() as
            | HTMLImageElement
            | HTMLCanvasElement;

        // ✅ GIỮ SIZE VÒNG NHƯ LÚC 7 VÒNG
        const referenceCircles = 7;
        const refMaxCircleWidth = areaWidth / (referenceCircles + 2);
        let circleScale = (refMaxCircleWidth * 0.95) / tex.width;

        // ✅ spacing nhỏ lại để nhét 10 vòng (tăng hệ số 0.7 -> 0.9 cho rộng hơn)

        // (tuỳ chọn) chống chồng lên nhau: nếu spacing nhỏ hơn đường kính vòng -> giảm scale chút xíu
        const circleW = tex.width * circleScale;
        if (spacing < circleW * 1.02) {
            circleScale = spacing / (tex.width * 1.02);
        }

        for (let i = 0; i < maxCircles; i++) {
            const x = startX + spacing * i;

            // 1) Vẽ vòng tròn
            const circle = this.add
                .image(x, y, 'circle_empty')
                .setOrigin(0.5)
                .setScale(circleScale)
                .setInteractive({ useHandCursor: true })
                .setDepth(2); // vòng tròn trên nền

            (circle as any).baseScaleX = circle.scaleX;
            (circle as any).baseScaleY = circle.scaleY;

            // 2) Lớp vẽ (màu) – cùng toạ độ, sẽ bị mask theo hình tròn
            const paintGfx = this.add.graphics().setDepth(3); // TRÊN vòng tròn
            paintGfx.setScrollFactor(0);

            // 4) Tạo mask hình tròn cho paintGfx
            const maskGfx = this.make.graphics({ x: 0, y: 0 }, false);
            maskGfx.fillStyle(0xffffff);
            maskGfx.fillCircle(
                circle.x,
                circle.y,
                (circle.displayWidth / 2) * 0.93
            );

            const circleMask = maskGfx.createGeometryMask();
            paintGfx.setMask(circleMask);

            // lưu lại để sau reset/destroy
            circle.setData('paintGfx', paintGfx);
            circle.setData('maskGfx', maskGfx);
            circle.setData('mask', circleMask);
            circle.setData('paintSet', new Set<string>());
            circle.setData('gridSize', this.paintGridSize);

            // pointerdown: bắt đầu tô + sound
            circle.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                // ❌ không cho tô nếu đang checking hoặc result
                if (this.state !== 'playing') return;
                this.audio.play('sfx-click');
                this.paintInCircle(circle, pointer);
            });

            // kéo tay để tô thêm
            circle.on('pointermove', (pointer: Phaser.Input.Pointer) => {
                // ❌ không cho tô nếu đang checking hoặc result
                if (this.state !== 'playing') return;
                if (!pointer.isDown) return;
                this.paintInCircle(circle, pointer);
            });

            this.circleSprites.push(circle);
        }
        // 👉 chỉ show hint ở level đầu tiên để không bị phiền
        if (this.currentLevelIndex === 0) {
            const midIndex = 0; // 3 với maxCircles = 7
            const targetCircle = this.circleSprites[midIndex];
            if (targetCircle) {
                this.showPaintHintForCircle(targetCircle);
            }
        }
    }

    // Tô màu bên trong 1 vòng tròn, + update lưới ô đã tô
    private paintInCircle(
        circle: Phaser.GameObjects.Image,
        pointer: Phaser.Input.Pointer
    ) {
        // 👉 Chỉ cần biết bé đã bắt đầu tô vào bất kỳ vòng nào → ẩn hint luôn
        this.hidePaintHint();

        const paintGfx = circle.getData(
            'paintGfx'
        ) as Phaser.GameObjects.Graphics;
        if (!paintGfx) return;

        // toạ độ tương đối so với tâm vòng
        const dx = pointer.worldX - circle.x;
        const dy = pointer.worldY - circle.y;

        const radius = (circle.displayWidth / 2) * 0.9; // 90% bán kính, chừa mép
        const dist = Math.sqrt(dx * dx + dy * dy);

        // nếu vẽ ngoài vòng thì bỏ, nên sau đó mask + check đều an toàn
        if (dist > radius) return;

        // vẽ chấm màu (màu brushColor)
        paintGfx.fillStyle(this.brushColor, 0.95);
        paintGfx.fillCircle(pointer.worldX, pointer.worldY, this.brushRadius);

        // cập nhật ô trong lưới để tính % tô (PHỦ THEO BÁN KÍNH BÚT)
        const gridSize =
            (circle.getData('gridSize') as number) || this.paintGridSize;
        const paintedSet = circle.getData('paintSet') as Set<string>;

        // chuẩn hóa toạ độ về [-1, 1]
        const nx = dx / radius; // -1..1
        const ny = dy / radius; // -1..1

        // bán kính bút ở hệ normalized (-1..1)
        const brushN = this.brushRadius / radius; // vd 24px / radius

        // đổi ra bán kính tính theo số ô grid (xấp xỉ)
        const rCells = Math.ceil((brushN * gridSize) / 2) + 1;

        // tâm ô gần nhất
        const cx = Math.floor(((nx + 1) / 2) * gridSize);
        const cy = Math.floor(((ny + 1) / 2) * gridSize);

        for (let gx = cx - rCells; gx <= cx + rCells; gx++) {
            for (let gy = cy - rCells; gy <= cy + rCells; gy++) {
                if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize)
                    continue;

                // tâm ô (gx,gy) chuẩn hoá về [-1,1]
                const cellNx = ((gx + 0.5) / gridSize) * 2 - 1;
                const cellNy = ((gy + 0.5) / gridSize) * 2 - 1;

                // ô phải nằm trong hình tròn
                if (cellNx * cellNx + cellNy * cellNy > 1) continue;

                // ô phải nằm trong vùng brush
                const ddx = cellNx - nx;
                const ddy = cellNy - ny;
                if (ddx * ddx + ddy * ddy <= brushN * brushN) {
                    paintedSet.add(`${gx},${gy}`);
                }
            }
        }
    }

    // Tính tỉ lệ % vùng đã được tô trong 1 vòng (0..1)
    private getCircleFillRatio(circle: Phaser.GameObjects.Image): number {
        const gridSize =
            (circle.getData('gridSize') as number) || this.paintGridSize;
        const paintedSet = circle.getData('paintSet') as Set<string>;

        if (!paintedSet) return 0;

        // Đếm xem có bao nhiêu ô lưới thuộc "vùng hình tròn"
        let circleCells = 0;

        for (let gx = 0; gx < gridSize; gx++) {
            for (let gy = 0; gy < gridSize; gy++) {
                // toạ độ tâm ô (gx, gy) chuẩn hoá về [-1, 1]
                const nx = ((gx + 0.5) / gridSize) * 2 - 1; // -1..1
                const ny = ((gy + 0.5) / gridSize) * 2 - 1; // -1..1

                if (nx * nx + ny * ny <= 1) {
                    circleCells++;
                }
            }
        }

        if (circleCells === 0) return 0;

        // paintedSet chỉ chứa các ô BEN TRONG hình tròn (do đã if (dist > radius) return)
        const ratio = paintedSet.size / circleCells;
        return ratio;
    }

    private animateLevelIntro() {
        const allTargets: Phaser.GameObjects.Image[] = [
            ...this.objectSprites,
            ...this.circleSprites,
        ];

        allTargets.forEach((obj) => {
            const anyObj = obj as any;
            if (anyObj.baseScaleX == null) {
                anyObj.baseScaleX = obj.scaleX;
                anyObj.baseScaleY = obj.scaleY;
            }
            obj.setScale(anyObj.baseScaleX * 0.75, anyObj.baseScaleY * 0.75);
        });

        this.tweens.add({
            targets: allTargets,
            scaleX: (target: any) => target.baseScaleX,
            scaleY: (target: any) => target.baseScaleY,
            duration: 400,
            ease: 'Back.Out',
        });
    }
    // Hiển thị icon đúng / sai ở góc dưới bên phải panel đồ vật
    private showCheckIcon(isCorrect: boolean) {
        // nếu chưa có panelBounds thì thôi
        if (!this.panelBounds.width || !this.panelBounds.height) return;

        // xoá icon cũ nếu có
        if (this.checkIcon) {
            this.checkIcon.destroy();
            this.checkIcon = undefined;
        }

        const texKey = isCorrect ? 'icon_check_true' : 'icon_check_false';

        const centerX = this.panelBounds.centerX;
        const centerY = this.panelBounds.centerY;
        const panelW = this.panelBounds.width;
        const panelH = this.panelBounds.height;

        // vị trí góc dưới bên phải panel (chừa một chút margin)
        const marginX = this.getW() * 0.015;
        const marginY = this.getH() * 0.015;

        const x = centerX + panelW / 2 - marginX;
        const y = centerY + panelH / 2 - marginY;

        const icon = this.add
            .image(x, y, texKey)
            .setOrigin(1, 1) // góc phải dưới
            .setDepth(5); // trên panel và object

        // scale icon cho hợp panel
        const tex = this.textures.get(texKey).getSourceImage() as
            | HTMLImageElement
            | HTMLCanvasElement;

        const texW = tex.width || 1;
        const texH = tex.height || 1;

        const targetSize = panelH * 0.18; // icon cao khoảng 18% panel
        const scale = targetSize / Math.max(texW, texH);

        icon.setScale(scale);

        // tween nhẹ cho vui mắt
        icon.setScale(scale * 0.5);
        this.tweens.add({
            targets: icon,
            scaleX: scale,
            scaleY: scale,
            duration: 220,
            ease: 'Back.Out',
        });

        this.checkIcon = icon;
    }

    // ========= Check & feedback =========

    // Đếm có bao nhiêu vòng được tô đủ (theo fillThreshold)
    private countFilledCircles(): number {
        let count = 0;

        for (const circle of this.circleSprites) {
            const ratio = this.getCircleFillRatio(circle);
            if (ratio >= this.fillThreshold) {
                count += 1;
            }
        }

        return count;
    }

    private handleDonePressed() {
        // chỉ cho ấn khi đang "playing"
        if (this.state !== 'playing') return;

        // chuyển sang trạng thái đang chấm
        this.state = 'checking';

        this.audio.play('sfx-click', { volume: 0.04 });

        const level = this.levels[this.currentLevelIndex];
        const filledCount = this.countFilledCircles();
        const isCorrect = filledCount === level.objectCount;

        if (isCorrect) {
            this.score += 1;
            // ✅ Đổi nét tô của các vòng đúng sang xanh lá
            this.highlightCorrectCirclesGreen();
            // ✅ Hiển thị số 1-2-3-... dưới mỗi đồ vật
            this.showCountNumbersForObjects(level);
            // ✅ Hiển thị icon đúng ở góc panel
            this.showCheckIcon(true);
            this.playCorrectFeedback(level);
        } else {
            // ❌ Hiển thị icon sai ở góc panel
            this.showCheckIcon(false);
            this.playWrongFeedback();
        }
    }

    private playCorrectFeedback(level: CountLevel) {
        // SFX đúng
        this.audio.play('sfx-correct', { volume: 0.9 });
        this.stopAllVoices();

        const playVoice = (key: string | undefined, onDone: () => void) => {
            if (!key || !this.audio.has(key)) {
                onDone();
                return;
            }
            this.audio.playFeedback(key, onDone);
        };

        const hasAnyVoice =
            (level.correctVoiceKey && this.audio.has(level.correctVoiceKey)) ||
            (level.correctDrawVoiceKey &&
                this.audio.has(level.correctDrawVoiceKey));

        if (hasAnyVoice) {
            playVoice(level.correctVoiceKey, () => {
                playVoice(level.correctDrawVoiceKey, () => {
                    this.playCountingSequence(level, () => {
                        // khoá game ở trạng thái checking trong lúc overlay chạy
                        this.state = 'checking';

                        // tạo đúng 14 item (có thể random từ iconPool của level)
                        const iconPool = ['broom'];

                        const items = Array.from({ length: 14 }, () => ({
                            key: Phaser.Utils.Array.GetRandom(
                                iconPool
                            ) as string,
                            scale: 0.65, // tuỳ chỉnh
                        }));

                        this.circleOverlay.show({
                            expectedCount: level.objectCount,
                            items,
                            promptKey: 'prompt_quantity_circle',
                            successKey: 'correct_quantity_circle',
                            failKey: 'voice_try_again_circel',
                            // dimAlpha: 0.88, // ✅ tối nền mạnh
                            onSuccess: () => {
                                this.exitCircleOverlay();
                                this.goToNextLevel();
                            },
                        });

                        // ✅ đợi panel rơi xong rồi “bay bé + bubble”
                        this.time.delayedCall(480, () => {
                            this.enterCircleOverlay(level.objectCount);
                        });
                    });
                });
            });
        } else {
            this.time.delayedCall(1000, () => {
                this.playCountingSequence(level, () => this.goToNextLevel());
            });
        }
    }

    private playWrongFeedback() {
        this.audio.play('sfx-wrong', { volume: 0.03 });
        this.stopAllVoices();

        this.audio.playFeedback('voice_try_again_draw');

        this.tweens.add({
            targets: this.circleSprites,
            x: '+=10',
            yoyo: true,
            duration: 60,
            repeat: 3,
        });

        this.time.delayedCall(400, () => {
            this.circleSprites.forEach((circle) => {
                const paintGfx = circle.getData(
                    'paintGfx'
                ) as Phaser.GameObjects.Graphics;
                const paintedSet = circle.getData('paintSet') as Set<string>;

                paintGfx?.clear();
                paintedSet?.clear();

                circle.setTexture('circle_empty');

                const baseScaleX = (circle as any).baseScaleX || circle.scaleX;
                const baseScaleY = (circle as any).baseScaleY || circle.scaleY;
                circle.setScale(baseScaleX, baseScaleY);
            });

            if (this.checkIcon) {
                this.checkIcon.destroy();
                this.checkIcon = undefined;
            }

            this.state = 'playing';
        });
    }

    // ========= Next level / End =========

    private goToNextLevel() {
        this.stopAllVoices();

        this.currentLevelIndex += 1;

        // reste vòng cho level tiếp theo
        this.circleSprites.forEach((circle) => {
            const paintGfx = circle.getData(
                'paintGfx'
            ) as Phaser.GameObjects.Graphics;
            const paintedSet = circle.getData('paintSet') as Set<string>;

            // xoá toàn bộ màu đã tô
            if (paintGfx) {
                paintGfx.clear();
            }
            if (paintedSet) {
                paintedSet.clear();
            }

            // texture vòng trở lại dạng rỗng (nếu bạn vẫn dùng)
            circle.setTexture('circle_empty');

            const baseScaleX = (circle as any).baseScaleX || circle.scaleX;
            const baseScaleY = (circle as any).baseScaleY || circle.scaleY;
            circle.setScale(baseScaleX, baseScaleY);
        });

        if (this.currentLevelIndex >= this.levels.length) {
            this.showResultScreen();
        } else {
            this.showCurrentLevel();
        }
    }

    private showResultScreen() {
        this.state = 'result';

        this.clearObjectsAndCircles();

        // 📴 tắt nhạc nền khi sang màn kết thúc
        this.audio.stopBgm('bgm_quantity');
        this.stopAllVoices();

        this.scene.start('EndGameScene', {
            score: this.score,
            total: this.levels.length,
            audio: this.audio, // ✅ thêm dòng này
        });

        // 👉 clear luôn hint nếu còn
        this.hidePaintHint();
    }

    restartGame() {
        this.stopAllVoices();
        this.audio.play('sfx-click');

        // 🔥 FIX: xoá hint cũ nếu còn
        this.hidePaintHint();

        // reste vòng khi chơi lại
        this.circleSprites.forEach((circle) => {
            const paintGfx = circle.getData(
                'paintGfx'
            ) as Phaser.GameObjects.Graphics;
            const paintedSet = circle.getData('paintSet') as Set<string>;

            // xoá toàn bộ màu đã tô
            if (paintGfx) {
                paintGfx.clear();
            }
            if (paintedSet) {
                paintedSet.clear();
            }

            // texture vòng trở lại dạng rỗng (nếu bạn vẫn dùng)
            circle.setTexture('circle_empty');

            const baseScaleX = (circle as any).baseScaleX || circle.scaleX;
            const baseScaleY = (circle as any).baseScaleY || circle.scaleY;
            circle.setScale(baseScaleX, baseScaleY);
        });
        // xoá label số nếu có
        this.countLabels.forEach((t) => t.destroy());
        this.countLabels = [];

        this.currentLevelIndex = 0;
        this.score = 0;
        this.state = 'playing';

        this.clearObjectsAndCircles();
        this.showCurrentLevel();
    }
}
