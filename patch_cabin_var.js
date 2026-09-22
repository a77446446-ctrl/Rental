const fs = require('fs');
let js = fs.readFileSync('public/js/main.js', 'utf8');

const targetFunctionStart = `async function updateCheckoutSummary() {
    var rentSum = 0;
    // cabin already found`;

const replacement = `async function updateCheckoutSummary() {
    var rentSum = 0;
    var cabin = state.cabins.find(function(c) { return c.id === state.selectedCabinId || c.c_id === state.selectedCabinId; });`;

js = js.replace(targetFunctionStart, replacement);

fs.writeFileSync('public/js/main.js', js);
console.log('patched updateCheckoutSummary cabin variable');
