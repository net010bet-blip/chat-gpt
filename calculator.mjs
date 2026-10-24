export function calculate(average, { direct = 7, target = 5, minimum = 3 } = {}) {
  if (![average, direct, target, minimum].every(n => Number.isFinite(n) && n >= 0 && n <= 10)) throw new Error('Use notas válidas entre 0 e 10.');
  if (minimum >= direct) throw new Error('O mínimo para a final precisa ser menor que a média de aprovação direta.');
  if (average >= direct) return { status: 'passed' };
  if (average < minimum) return { status: 'ineligible' };
  const required = Math.max(0, Math.ceil((2 * target - average - 1e-9) * 100) / 100);
  return { status: required > 10 ? 'impossible' : 'final', required };
}
