import type { Player } from '../entities/Player';
import { levelForXp, SKILLS, type SkillId } from '../data/skills';
import { bus, log } from '../core/EventBus';

export function addXp(player: Player, skill: SkillId, amount: number) {
  // Skill XP is intentionally stored as whole points. Keeping normalization at
  // this boundary prevents future recipes/gathering formulas from creating
  // invisible fractional progress that the player cannot reconcile with the UI.
  const awarded = Math.max(0, Math.round(amount));
  if (awarded <= 0) return;

  const before = levelForXp(player.skillsXp[skill]);
  player.skillsXp[skill] += awarded;
  const after = levelForXp(player.skillsXp[skill]);
  const def = SKILLS.find((s) => s.id === skill)!;
  log(`+${awarded} ${def.name} XP`, 'xp');
  if (after > before) {
    log(`Congratulations! Your ${def.name} level is now ${after}.`, 'xp');
    bus.emit('levelUp', { skill: def.name, level: after });
    if (skill === 'hitpoints') player.currentHp = Math.min(player.maxHp(), player.currentHp + (after - before));
  }
  bus.emit('skillsChanged', undefined);
}
