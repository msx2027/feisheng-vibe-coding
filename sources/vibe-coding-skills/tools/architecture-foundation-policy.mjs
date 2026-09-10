// 开工前架构地基的机器可验证触发策略；Skill 文本负责解释与执行。
export const HIGH_IMPACT_ARCHITECTURE_CHANGES = Object.freeze([
  "modules-at-least-2",
  "data",
  "interface",
  "permission",
  "deploy",
  "stack",
  "architecture",
]);

const HIGH_IMPACT_CHANGE_SET = new Set(HIGH_IMPACT_ARCHITECTURE_CHANGES);

export function requiresArchitectureFoundation({ isNewProject, tier, ordinarySingleModule, changes = [] }) {
  if (tier === "T0" || tier === "T1") return false;
  if (isNewProject) return true;
  if (changes.some((change) => HIGH_IMPACT_CHANGE_SET.has(change))) return true;
  return false;
}
