// resistencia: 1.0 = mais forte (aço) ... menor = mais fraca
const MATERIAIS = {
  aco: { nome: "Aço", resistencia: 1.0 },
  metal: { nome: "Metal", resistencia: 0.9 },
  aluminio: { nome: "Alumínio", resistencia: 0.6 },
  psai: { nome: "PSAI", resistencia: 0.3 },
  plastico: { nome: "Plástico", resistencia: 0.25 },
};

// Torque (N.m) que um parafuso suporta em chapa de resistência 1.0. 4.0 e 4.5 interpolados.
const TORQUE_BASE = { "4.0": 0.9, 4.2: 1.0, 4.5: 1.2, 4.8: 1.5, "5.0": 1.5 };
const PARAFUSO_PADRAO = "4.2";

// [torque máximo da faixa, seletor mín, seletor máx] — aproximado a partir da planilha
const SELETOR_POR_TORQUE = [
  [0.5, 4, 5],
  [1.5, 5, 6],
  [Infinity, 6, 8],
];

//CÁLCULO
// Chapa mais fina que o parafuso perde resistência na proporção (espessura / diâmetro)
function resistenciaChapa(chave, espessura, diametro) {
  const fatorEspessura = espessura ? Math.min(1, espessura / diametro) : 1;
  return MATERIAIS[chave].resistencia * fatorEspessura;
}

function calcularTorque(mat1, esp1, mat2, esp2, diametro) {
  const base = TORQUE_BASE[diametro];
  if (!MATERIAIS[mat1] || !MATERIAIS[mat2] || base === undefined) {
    throw new Error("Material ou parafuso não encontrado.");
  }
  const d = parseFloat(diametro);
  const r1 = resistenciaChapa(mat1, esp1, d);
  const r2 = resistenciaChapa(mat2, esp2, d);

  const torque = Math.max(0.1, Math.round(base * Math.min(r1, r2) * 10) / 10);
  const [, min, max] = SELETOR_POR_TORQUE.find(([limite]) => torque <= limite);
  return { torque, min, max, limitante: r1 <= r2 ? 1 : 2 };
}

//INTERFACE
const $ = (id) => document.getElementById(id);
const nomeSelecionado = (id) => $(id).selectedOptions[0].text;
const formatar = (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function lerEspessura(id) {
  const txt = $(id).value.trim().replace(",", ".");
  if (!txt) return null;
  const n = parseFloat(txt);
  if (isNaN(n) || n <= 0)
    throw new Error("Espessura inválida: use um número maior que zero (mm).");
  return n;
}

function calcular() {
  const usar = $("usarParafuso").checked;
  const diametro = usar ? $("op3").value : PARAFUSO_PADRAO;

  const r = calcularTorque(
    $("op1").value,
    lerEspessura("esp1"),
    $("op2").value,
    lerEspessura("esp2"),
    diametro,
  );

  $("valor").textContent = formatar(r.torque);
  $("min").textContent = r.min;
  $("max").textContent = r.max;
  $("m1").textContent = nomeSelecionado("op1");
  $("m2").textContent = nomeSelecionado("op2");
  $("parafuso").textContent = usar
    ? `parafuso de ${nomeSelecionado("op3")}`
    : `parafuso de ${formatar(parseFloat(PARAFUSO_PADRAO))} mm (padrão)`;

  const limitante =
    r.limitante === 1 ? nomeSelecionado("op1") : nomeSelecionado("op2");
  const nota = $("nota");
  nota.classList.remove("erro");
  nota.textContent = `Chapa limitante: ${r.limitante} (${limitante}).`;
}

$("usarParafuso").addEventListener(
  "change",
  (e) => ($("op3").disabled = !e.target.checked),
);

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  try {
    calcular();
  } catch (err) {
    $("nota").textContent = err.message;
    $("nota").classList.add("erro");
  }
});
