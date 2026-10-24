import { calculate } from './calculator.mjs';
const form = document.querySelector('#calculator');
const result = document.querySelector('#result');
const format = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
form.addEventListener('submit', event => {
  event.preventDefault();
  result.classList.remove('error');
  try {
    const raw = document.querySelector('#average').value.trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(raw)) throw new Error('Informe uma média válida entre 0 e 10.');
    const average = Number(raw.replace(',', '.'));
    const rules = Object.fromEntries(['direct', 'target', 'minimum'].map(id => [id, document.getElementById(id).valueAsNumber]));
    const outcome = calculate(average, rules);
    const p = document.createElement('p');
    if (outcome.status === 'passed') p.textContent = 'Sua média já atende à aprovação direta pela regra informada! Confira também frequência e critérios da disciplina.';
    if (outcome.status === 'ineligible') p.textContent = 'Sua média está abaixo do mínimo para fazer a final pela regra informada. Confira as opções com seu colegiado.';
    if (outcome.status === 'impossible') p.textContent = 'Seria necessária uma nota acima de 10. Confira a regra e converse com seu colegiado.';
    if (outcome.status === 'final') {
      p.append('Você precisa tirar pelo menos');
      const strong = document.createElement('strong'); strong.textContent = format(outcome.required) + ' na final'; p.append(strong);
      const small = document.createElement('small'); small.textContent = `(${format(average)} + ${format(outcome.required)}) ÷ 2 ≥ ${format(rules.target)} · conforme a regra informada`; p.append(small);
    }
    result.replaceChildren(p);
  } catch (error) { result.classList.add('error'); result.textContent = error.message; }
});
form.addEventListener('input', () => { result.classList.remove('error'); result.textContent = 'Valores alterados. Calcule novamente para atualizar sua meta.'; });
