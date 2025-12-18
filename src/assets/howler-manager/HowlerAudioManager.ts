import { Howl, Howler } from 'howler';
import type { HowlerSoundDef } from '../quantityAssets';

export class HowlerAudioManager {
    private sounds = new Map<string, Howl>();

    private currentPrompt?: Howl;
    private currentFeedback?: Howl;
    stopAll() {
        Howler.stop();
    }


    constructor(defs: Record<string, HowlerSoundDef>) {
        for (const [key, def] of Object.entries(defs)) {
            this.sounds.set(
                key,
                new Howl({
                    src: [def.src],
                    loop: !!def.loop,
                    volume: def.volume ?? 1,
                    preload: true,
                    html5: def.html5 === true,
                })
            );
        }
    }

    unlock() {
        // iOS cần gesture để resume WebAudio context
        Howler.ctx?.resume?.();
    }

    has(key: string) {
        return this.sounds.has(key);
    }

    stopAllVoices() {
        this.currentPrompt?.stop();
        this.currentFeedback?.stop();
        this.currentPrompt = undefined;
        this.currentFeedback = undefined;
    }
    stopAllExceptBgm(bgmKey = 'bgm_quantity') {
        for (const [key, howl] of this.sounds.entries()) {
            // tuỳ bạn lưu map thế nào
            if (key === bgmKey) continue;
            howl.stop();
        }
    }

    play(
        key: string,
        opts?: { volume?: number; onEnd?: () => void; stopSame?: boolean }
    ) {
        const h = this.sounds.get(key);
        if (!h) return;

        if (opts?.stopSame) h.stop();

        const id = h.play();
        if (opts?.volume != null) h.volume(opts.volume, id);
        if (opts?.onEnd) h.once('end', opts.onEnd, id);
    }

    playPrompt(key?: string) {
        if (!key) return;
        this.stopAllVoices();
        const h = this.sounds.get(key);
        if (!h) return;
        this.currentPrompt = h;
        h.stop();
        h.play();
    }

    playFeedback(key: string, onEnd?: () => void) {
        this.stopAllVoices();
        const h = this.sounds.get(key);
        if (!h) return;
        this.currentFeedback = h;
        h.stop();
        this.play(key, { onEnd });
    }

    playBgm(key = 'bgm_quantity') {
        const h = this.sounds.get(key);
        if (!h) return;
        if (h.playing()) return;
        h.play();
    }

    stopBgm(key = 'bgm_quantity') {
        this.sounds.get(key)?.stop();
    }
}
