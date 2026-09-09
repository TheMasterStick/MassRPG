// Simplified OSRS-style combat formulas: effective level -> attack/defence
// "rolls" -> hit chance, plus a max-hit formula driven by strength/bonus.

export function maxHitMelee(strengthLevel: number, strengthBonus: number): number {
  const effective = strengthLevel + 8;
  return Math.max(1, Math.floor(0.5 + (effective * (strengthBonus + 64)) / 640));
}

export function maxHitRanged(rangedLevel: number, rangedStrengthBonus: number): number {
  const effective = rangedLevel + 8;
  return Math.max(1, Math.floor(0.5 + (effective * (rangedStrengthBonus + 64)) / 640));
}

export function maxHitMagic(magicLevel: number): number {
  return Math.max(1, Math.floor(2 + magicLevel * 0.6));
}

export function attackRoll(level: number, bonus: number): number {
  return (level + 8) * (bonus + 64);
}

export function defenceRoll(level: number, bonus: number): number {
  return (level + 8) * (bonus + 64);
}

export function hitChance(atkRoll: number, defRoll: number): number {
  if (atkRoll > defRoll) {
    return 1 - (defRoll + 2) / (2 * (atkRoll + 1));
  }
  return atkRoll / (2 * (defRoll + 1));
}

export function rollDamage(maxHit: number, hitChanceValue: number, rng: () => number): number {
  if (rng() > hitChanceValue) return 0; // miss
  return Math.floor(rng() * (maxHit + 1));
}
