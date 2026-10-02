<<<<<<< HEAD
/**
 * Calculadora de torque
 * Cada chapa tem uma resistência = coeficiente do material × fator de espessura.
 * A chapa MAIS FRACA limita a junta:
 *   Torque (N.m) = TORQUE_BASE[diâmetro do parafuso] × menor resistência
 * O seletor da parafusadeira vem de faixas de torque (SELETOR_POR_TORQUE).
 */

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
=======
/**
 * Calculadora de torque em 3 níveis.
 * Nível 1: só materiais | Nível 2: materiais + espessuras | Nível 3: parafuso escolhido
 */

// ---------- BASE DE DADOS ----------
const MATERIAIS = {
  psai: { nome: "PSAI / Plástico", sigmaAdm: 25, fatorEngrenamento: 2.5 }, // MPa
  aluminio: { nome: "Alumínio", sigmaAdm: 150, fatorEngrenamento: 1.5 },
  aco: { nome: "Aço", sigmaAdm: 300, fatorEngrenamento: 1.0 },
};

const PARAFUSOS = {
  M3: { diametro: 0.003, at: 5.03, areaCabeca: 20 }, // m, mm², mm²
  M4: { diametro: 0.004, at: 8.78, areaCabeca: 35 },
  M5: { diametro: 0.005, at: 14.2, areaCabeca: 50 },
  M6: { diametro: 0.006, at: 20.1, areaCabeca: 75 },
  M8: { diametro: 0.008, at: 36.6, areaCabeca: 130 },
  M10: { diametro: 0.01, at: 58.0, areaCabeca: 200 },
  M12: { diametro: 0.012, at: 84.3, areaCabeca: 300 },
};

const CLASSES_RESISTENCIA = {
  4.6: 240,
  5.8: 400,
  8.8: 640,
  10.9: 900,
  12.9: 1080,
};
const COEF_ATRITO = { seco: 0.2, zincado: 0.15, lubrificado: 0.12 };

// ---------- AJUSTES (a tela não pergunta esses dados) ----------
const CLASSE_PADRAO = "8.8";
const ATRITO_PADRAO = "seco";
const FATOR_MINIMO = 0.7; // mínimo = 70% do torque máximo calculado

// ---------- FUNÇÕES DE CÁLCULO ----------
function buscarMateriais(a, b) {
  const m1 = MATERIAIS[a],
    m2 = MATERIAIS[b];
  if (!m1 || !m2) throw new Error("Material não encontrado no banco de dados.");
  return [m1, m2];
}

// Pré-carga limitada pelo menor valor entre esmagamento da chapa e resistência do parafuso
function forcaLimite(m1, m2, parafuso, sigmaY) {
  const forcaParafuso = 0.75 * sigmaY * parafuso.at; // N
  const forcaChapa = Math.min(m1.sigmaAdm, m2.sigmaAdm) * parafuso.areaCabeca; // N
  return {
    forca: Math.min(forcaParafuso, forcaChapa),
    limitante:
      forcaChapa < forcaParafuso
        ? "esmagamento da chapa"
        : "resistência do parafuso",
  };
}

// Diâmetro máximo (mm) permitido pelas espessuras
function diametroMaximo(m1, e1, m2, e2) {
  return Math.min(e1 / m1.fatorEngrenamento, e2 / m2.fatorEngrenamento);
}

function montar(nivel, parafusoNome, m1, m2, parafuso, sigmaY, K, extra = {}) {
  const { forca, limitante } = forcaLimite(m1, m2, parafuso, sigmaY);
  return {
    nivel,
    parafuso: parafusoNome,
    limitante,
    forcaPreCargaN: Math.round(forca),
    torqueNm: parseFloat((K * parafuso.diametro * forca).toFixed(2)),
    avisos: [],
    ...extra,
  };
}

function calcularNivel1(mat1, mat2) {
  const [m1, m2] = buscarMateriais(mat1, mat2);
  return montar(
    1,
    "M6 (assumido)",
    m1,
    m2,
    PARAFUSOS.M6,
    CLASSES_RESISTENCIA[CLASSE_PADRAO],
    COEF_ATRITO[ATRITO_PADRAO],
  );
}

function calcularNivel2(mat1, e1, mat2, e2) {
  const [m1, m2] = buscarMateriais(mat1, mat2);
  const dMax = diametroMaximo(m1, e1, m2, e2); // mm

  let escolhido = "M3";
  for (const [chave, p] of Object.entries(PARAFUSOS)) {
    if (p.diametro * 1000 <= dMax) escolhido = chave;
  }

  const r = montar(
    2,
    `${escolhido} (recomendado)`,
    m1,
    m2,
    PARAFUSOS[escolhido],
    CLASSES_RESISTENCIA[CLASSE_PADRAO],
    COEF_ATRITO[ATRITO_PADRAO],
  );
  if (dMax < 3)
    r.avisos.push("Chapa muito fina: nem o M3 tem engrenamento adequado.");
  return r;
}

function calcularNivel3(
  mat1,
  e1,
  mat2,
  e2,
  tipo,
  classe = CLASSE_PADRAO,
  atrito = ATRITO_PADRAO,
) {
  const [m1, m2] = buscarMateriais(mat1, mat2);
  const parafuso = PARAFUSOS[tipo.toUpperCase()];
  const sigmaY = CLASSES_RESISTENCIA[classe];
  const K = COEF_ATRITO[atrito];
  if (!parafuso || !sigmaY || !K)
    throw new Error("Dados inválidos para o cálculo.");

  const r = montar(3, tipo.toUpperCase(), m1, m2, parafuso, sigmaY, K);
  if (e1 && e2) {
    const dMax = diametroMaximo(m1, e1, m2, e2);
    if (parafuso.diametro * 1000 > dMax) {
      r.avisos.push(
        `As espessuras comportam parafuso de até ${dMax.toFixed(1)} mm.`,
      );
    }
  }
  return r;
}

// ---------- INTERFACE ----------
const $ = (id) => document.getElementById(id);
const nomeSelecionado = (id) => $(id).selectedOptions[0].text;
const formatar = (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function lerEspessura(id) {
  const txt = $(id).value.trim().replace(",", ".");
  if (!txt) return null;
  const n = parseFloat(txt);
  if (isNaN(n) || n <= 0)
    throw new Error("Espessura inválida: use um número maior que zero (mm).");
  return n;
}

function calcular() {
  const mat1 = $("op1").value,
    mat2 = $("op2").value;
  const e1 = lerEspessura("esp1"),
    e2 = lerEspessura("esp2");
  const usarParafuso = $("usarParafuso").checked;

  let r;
  const avisos = [];
  if (usarParafuso) {
    r = calcularNivel3(mat1, e1, mat2, e2, $("op3").value);
  } else if (e1 && e2) {
    r = calcularNivel2(mat1, e1, mat2, e2);
  } else {
    r = calcularNivel1(mat1, mat2);
    if (e1 || e2)
      avisos.push("Informe as duas espessuras para um cálculo mais preciso.");
  }

  const maximo = r.torqueNm;
  const minimo = parseFloat((maximo * FATOR_MINIMO).toFixed(2));
  const medio = (minimo + maximo) / 2;

  $("valor").textContent = formatar(medio);
  $("min").textContent = formatar(minimo);
  $("max").textContent = formatar(maximo);
  $("m1").textContent = nomeSelecionado("op1");
  $("m2").textContent = nomeSelecionado("op2");
  $("parafuso").textContent = `parafuso ${r.parafuso}`;

  const nota = $("nota");
  nota.classList.remove("erro");
  nota.textContent = [
    `Nível ${r.nivel} de cálculo. Limite por ${r.limitante}.`,
    ...avisos,
    ...r.avisos,
  ].join(" ");
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
>>>>>>> 9905d301567f5ad8402bdc47a675e50c3d137a15
