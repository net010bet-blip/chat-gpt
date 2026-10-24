import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calculator.mjs';
test('aprovação direta e limites da final', () => {
 assert.equal(calculate(7).status, 'passed');
 assert.equal(calculate(10).status, 'passed');
 assert.equal(calculate(2.99).status, 'ineligible');
 assert.deepEqual(calculate(3), {status:'final',required:7});
 assert.deepEqual(calculate(4.5), {status:'final',required:5.5});
 assert.deepEqual(calculate(6.99), {status:'final',required:3.01});
});
test('validação e regras personalizadas', () => {
 for (const value of [-1,11,NaN,Infinity]) assert.throws(() => calculate(value));
 assert.throws(() => calculate(4,{minimum:8,direct:7}));
 assert.equal(calculate(3,{target:8}).status,'impossible');
 assert.deepEqual(calculate(4,{target:2}),{status:'final',required:0});
});
