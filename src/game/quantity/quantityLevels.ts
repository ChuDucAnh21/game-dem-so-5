// src/game/quantity/quantityLevels.ts
import type { CountLevel } from './quantityTypes';

export function buildQuantityLevels(): CountLevel[] {
  return [
    {
      id: 1,
      number: 5,
      title: 'SỐ LƯỢNG 5',
      name: 'cây nến',
      objectIcon: ['candle'],
      objectCount: 5,
      maxCircles: 4,
      promptKey: 'prompt_quantity_draw',
      correctVoiceKey: 'correct_quantity_draw',
      correctDrawVoiceKey: 'correct_draw_candle',
    },
    
  ]
}
