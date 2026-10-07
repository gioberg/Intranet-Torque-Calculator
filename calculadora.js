/**
 * Calculadora de torque
 * O torque SOBE com a espessura e a resistência das chapas, até bater no limite do parafuso:
 *   T_chapa    = K_CHAPA × diâmetro × Σ(resistência do material × espessura)
 *   T_parafuso = K × d × 0,75 × σy × At          (mesma fórmula da calculadora de pré-carga)
 *   Torque     = o MENOR entre os dois
 */

// ---------- DADOS (edite aqui) ----------
// resistencia: 1.0 = mais forte (aço) ... menor = mais fraca
const MATERIAIS = {
  aco: { nome: "Aço", resistencia: 1.0 },
  metal: { nome: "Metal", resistencia: 0.9 },
  aluminio: { nome: "Alumínio", resistencia: 0.6 },
  psai: { nome: "PSAI", resistencia: 0.3 },
  plastico: { nome: "Plástico", resistencia: 0.25 },
};

const PARAFUSO_PADRAO = "4.2";
const ESPESSURA_PADRAO = 1; // mm, usada quando o campo fica vazio

// Chapa: calibrado para aço 1 mm + aço 1 mm com parafuso 4,2 mm = 1,0 N.m (planilha)
const K_CHAPA = 0.119;

// Parafuso: classe 8.8, 75% do escoamento, atrito zincado (como na calculadora de pré-carga)
const SIGMA_Y = 640; // MPa
const K_ATRITO = 0.2;
const AT_TABELA = { 5: 14.2, 6: 20.1, 8: 36.6, 10: 58.0 }; // mm² (métricos)
const areaResistente = (d) => AT_TABELA[d] ?? 0.57 * d * d; // aproximação p/ 4,0 a 4,8

// [torque máximo da faixa, seletor mín, seletor máx] — aproximado a partir da planilha
const SELETOR_POR_TORQUE = [
  [0.5, 4, 5],
  [1.5, 5, 6],
  [Infinity, 6, 8],
];
const TORQUE_MAX_PLANILHA = 1.6; // maior torque que a planilha da linha cobre

//CÁLCULO
function torqueParafuso(d) {
  const forca = 0.75 * SIGMA_Y * areaResistente(d); // N
  return K_ATRITO * (d / 1000) * forca; // N.m
}

// Capacidade da chapa: material × espessura (cresce de forma contínua)
function capacidadeChapa(chave, espessura) {
  return MATERIAIS[chave].resistencia * (espessura ?? ESPESSURA_PADRAO);
}

function calcularTorque(mat1, esp1, mat2, esp2, diametro) {
  const d = parseFloat(diametro);
  if (!MATERIAIS[mat1] || !MATERIAIS[mat2] || isNaN(d)) {
    throw new Error("Material ou parafuso não encontrado.");
  }

  const tChapa =
    K_CHAPA * d * (capacidadeChapa(mat1, esp1) + capacidadeChapa(mat2, esp2));
  const tParafuso = torqueParafuso(d);

  const torque = Math.max(
    0.1,
    Math.round(Math.min(tChapa, tParafuso) * 10) / 10,
  );
  const [, min, max] = SELETOR_POR_TORQUE.find(([limite]) => torque <= limite);
  return {
    torque,
    min,
    max,
    limitadoPeloParafuso: tParafuso < tChapa,
    espessuraAssumida: esp1 == null || esp2 == null,
  };
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

  const avisos = [
    r.limitadoPeloParafuso
      ? "Limite: resistência do parafuso."
      : "Limite: resistência das chapas.",
  ];
  if (r.espessuraAssumida) {
    avisos.push(`Espessura não informada: assumido ${ESPESSURA_PADRAO} mm.`);
  }
  if (r.torque > TORQUE_MAX_PLANILHA) {
    avisos.push(
      "Acima da faixa da planilha da linha: confirme com a engenharia.",
    );
  }
  const nota = $("nota");
  nota.classList.remove("erro");
  nota.textContent = avisos.join(" ");
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
