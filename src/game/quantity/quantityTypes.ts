// src/game/quantity/quantityTypes.ts
export type CountLevel = {
  id: number;
  number: 5;
  title: string;
  name: string;
  objectIcon: string[];
  objectCount: number;
  maxCircles: number;
  promptKey?: string;
  correctVoiceKey?: string;
  correctDrawVoiceKey?: string;
};
