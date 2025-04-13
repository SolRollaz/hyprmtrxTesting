// File: /api/tournaments/validateResult.js

/**
 * Evaluates a single rule condition against the result.
 * Supports common logical and temporal checks.
 */
function evaluateRule(rule, result, previousResult = null) {
  const { field, condition, value } = rule;

  const fieldValue = result?.[field];
  const prevValue = previousResult?.[field];

  switch (condition) {
    case "equals":
      return fieldValue === value;

    case "greater_than":
      return fieldValue > value;

    case "less_than":
      return fieldValue < value;

    case "increases_by_1":
      if (prevValue === undefined) return true;
      return fieldValue === prevValue + 1;

    case "within_last_seconds":
      if (!fieldValue || typeof fieldValue !== "number") return false;
      const now = Date.now();
      return now - fieldValue <= value * 1000;

    default:
      return true; // Unknown rule = accept by default
  }
}

/**
 * Validates a submitted result against anti_cheat rules.
 * 
 * @param {Object} result - The current result from game backend.
 * @param {Object} antiCheat - The anti_cheat block from the tournament.
 * @param {Object} [previousResult] - Optional previous submission from this user.
 * @returns {Object} - { valid: Boolean, errors: Array }
 */
export default function validateResult(result, antiCheat = {}, previousResult = null) {
  const errors = [];
  if (!antiCheat.rules || !Array.isArray(antiCheat.rules)) {
    return { valid: true }; // No rules = always valid
  }

  for (const rule of antiCheat.rules) {
    const passed = evaluateRule(rule, result, previousResult);
    if (!passed) {
      errors.push(`Failed rule: ${rule.field} - ${rule.condition}${rule.value !== undefined ? ` (${rule.value})` : ""}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

