

export type HowlerSoundDef = { src: string; volume?: number; loop?: boolean;  html5?: boolean; };

export type AssetItem = { key: string; url: string };

export const QUANTITY_IMAGES: AssetItem[] = [
  // bé
  { key: 'avata_child', url: 'assets/images/characters/avata_child.png' },


  // cây nến
  { key: 'candle', url: 'assets/images/animals/candle.png' },
  { key: 'broom', url: 'assets/images/animals/broom.png' },

  

  // UI
  { key: 'circle_empty', url: 'assets/images/ui/circle.png' },
  { key: 'circle_border', url: 'assets/images/ui/circle_border.png' },
  { key: 'circle_filled', url: 'assets/images/ui/circle_filled.png' },
  { key: 'objects_panel', url: 'assets/images/ui/board.png' },
  { key: 'title_banner', url: 'assets/images/ui/title_banner.png' },
  { key: 'hint_finger', url: 'assets/images/ui/hand.png' },
  { key: 'icon_check_true', url: 'assets/images/ui/check_true.png' },
  { key: 'icon_check_false', url: 'assets/images/ui/check_false.png' },
];

export const QUANTITY_SOUNDS: Record<string, HowlerSoundDef> = {
  //sfx
  "sfx-correct": { src: "assets/audio/sfx/correct.mp3", volume: 0.9, html5: true },
  "sfx-wrong":   { src: "assets/audio/sfx/wrong.mp3",   volume: 0.03, html5: true },
  "sfx-click":   { src: "assets/audio/sfx/click.mp3",   volume: 0.2 , html5: true},
  "complete":   { src: 'assets/audio/sfx/complete.mp3', volume: 1.0 , html5: true},
  "fireworks":   { src: 'assets/audio/sfx/fireworks.mp3', loop: true,  volume: 0.2, html5: true },
  "applause":   { src: 'assets/audio/sfx/applause.mp3', loop: true,  volume: 0.2, html5: true },

  //hướng dẫn (prompt)
  "prompt_quantity_draw": { src: "assets/audio/prompt/prompt_draw_candle.mp3", volume: 1.0, html5: true },
  "prompt_quantity_circle": { src: "assets/audio/prompt/prompt_circle_candle.mp3", volume: 1.0, html5: true },
   "voice_rotate": { src: "assets/audio/prompt/voice_rotate.mp3", volume: 1.0, html5: true},

  //khen
  "correct_quantity_draw": { src: "assets/audio/sfx/correct_answer-4.mp3", volume: 0.9, html5: true },
  "correct_quantity_circle": { src: "assets/audio/sfx/correct_answer-5.mp3", volume: 0.9, html5: true },

  
  //đếm số
  "count_1": { src: "assets/audio/count/number_one.mp3",   volume: 1.0 , html5: true},
  "count_2": { src: "assets/audio/count/number_two.mp3",   volume: 1.0, html5: true },
  "count_3": { src: "assets/audio/count/number_three.mp3",   volume: 1.0, html5: true },
  "count_4": { src: "assets/audio/count/number_four.mp3",   volume: 1.0, html5: true },
  "count_5": { src: "assets/audio/count/number_five.mp3",   volume: 1.0, html5: true },

  //khác
  "voice_try_again_draw": { src: "assets/audio/prompt/retry_draw.mp3", volume: 1.0 , html5: true},
  "voice_try_again_circel": { src: "assets/audio/prompt/retry_circle.mp3", volume: 1.0 , html5: true},

   "bgm_quantity": { src: "assets/audio/bg/music_bg.mp3", loop: true, volume: 0.2, html5: false},

  
};
