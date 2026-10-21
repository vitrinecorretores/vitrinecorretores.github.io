/* Vitrine — relógio do teleprompter em segundo plano (timers de worker não são reduzidos em abas ocultas). */
var i = setInterval(function () { postMessage(1); }, 33);
onmessage = function () { clearInterval(i); close(); };
