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

const DIAMETRO_PADRAO = 4.2; // mm, usado quando "Usar parafuso" está desmarcado

// Lista oficial de parafusos (planilha "parafusos_ordenados_por_comprimento").
// comprimento e diametro em mm.
const PARAFUSOS = [
  {
    codigo: "327",
    comprimento: 9.5,
    diametro: 4.2,
    tipo: "Autoatarrachante",
    descricao: "PARAF AAX CAB FLANGEADA FENDA CRUZADA 4,2 X 9,5 ZB",
  },
  {
    codigo: "19592",
    comprimento: 10,
    diametro: 4.0,
    tipo: "Parafuso Plástico",
    descricao: "PARAF PLAST CAB FLANGEADA FENDA CRUZADA 4,0 X 10 ZB",
  },
  {
    codigo: "206",
    comprimento: 12.7,
    diametro: 4.76,
    tipo: "Parafuso Máquina",
    descricao: "PARAF MAQ CAB LENTILHA FENDA CRUZADA 3/16 X 1/2 ZB",
  },
  {
    codigo: "1042",
    comprimento: 13,
    diametro: 4.2,
    tipo: "Ponta Broca",
    descricao: "PARAF PONTA BROCA CAB PANELA FENDA CRUZADA 4,2 X 13 ZB",
  },
  {
    codigo: "325",
    comprimento: 13,
    diametro: 4.8,
    tipo: "Autoatarrachante",
    descricao: "PARAF AAX CAB CHATA FENDA CRUZADA 4,8 X 13ZB",
  },
  {
    codigo: "6953",
    comprimento: 14,
    diametro: 4.0,
    tipo: "Autoatarrachante",
    descricao: "PARAF AAX CAB PANELA FENDA CRUZADA 4,0 X 14ZP",
  },
  {
    codigo: "349",
    comprimento: 16,
    diametro: 4.2,
    tipo: "Autoatarrachante",
    descricao: "PARAF AAX CAB CHATA FENDA CRUZADA 4,2 X 16ZB",
  },
  {
    codigo: "26355",
    comprimento: 16,
    diametro: 5.0,
    tipo: "Parafuso Máquina",
    descricao: "PARAF MAQ CAB PANELA FENDA CRUZADA M5 X 16ZP",
  },
  {
    codigo: "350",
    comprimento: 19,
    diametro: 4.2,
    tipo: "Autoatarrachante",
    descricao: "PARAF AAX CAB PANELA FENDA CRUZADA 4,2 X 19ZB",
  },
  {
    codigo: "21084",
    comprimento: 19,
    diametro: 4.2,
    tipo: "Ponta Broca",
    descricao: "PARAF PONTA BROCA CAB PANELA FENDA CRUZADA 4,2 X 19ZB",
  },
  {
    codigo: "21741",
    comprimento: 20,
    diametro: 5.0,
    tipo: "Parafuso Máquina",
    descricao: "PARAF MAQ CAB PANELA FENDA CRUZADA M5 X 0,8 X 20 ZA",
  },
  {
    codigo: "12261",
    comprimento: 22,
    diametro: 4.8,
    tipo: "Autoatarrachante",
    descricao: "PARAF AAX CAB PANELA FENDA CRUZADA 4,8 X 22 ZP",
  },
  {
    codigo: "351",
    comprimento: 25.4,
    diametro: 7.94,
    tipo: "Sextavado",
    descricao: "PARAF SEXTAVADO ROSCA TOTAL 5/16 X 1 ZB",
  },
  {
    codigo: "18525",
    comprimento: 30,
    diametro: 4.5,
    tipo: "Parafuso Plástico",
    descricao: "PARAFUSO PLASTIC CAB FLANGEADA PH 4,5 X 30ZB",
  },
  {
    codigo: "14279",
    comprimento: 45,
    diametro: 4.5,
    tipo: "Autoatarrachante",
    descricao: "PARAF AAX CAB CHATA FENDA CRUZADA 4,5 X 45 ZA",
  },
  {
    codigo: "18526",
    comprimento: 45,
    diametro: 4.5,
    tipo: "Parafuso Plástico",
    descricao: "PARAFUSO PLASTIC CAB FLANG PH 4,5 X 45ZB",
  },
];
const acharParafuso = (codigo) => PARAFUSOS.find((p) => p.codigo === codigo);
const ESPESSURA_PADRAO = 1; // mm, usada quando o campo fica vazio

// Chapa: calibrado para aço 1 mm + aço 1 mm com parafuso 4,2 mm = 1,0 N.m (planilha)
const K_CHAPA = 0.119;

// Parafuso: classe 8.8, 75% do escoamento, atrito zincado (como na calculadora de pré-carga)
const SIGMA_Y = 640; // MPa
const K_ATRITO = 0.2;
const AT_TABELA = { 5: 14.2 }; // mm² (M5 métrico)
const areaResistente = (d) => AT_TABELA[d] ?? 0.57 * d * d; // aproximação para os demais diâmetros

// Seletor da parafusadeira: vai de 1 a 15 (15 = máximo da parafusadeira).
// Cresce de forma contínua com o torque, por interpolação linear entre dois pontos da planilha:
//   0,3 N.m ≈ seletor 4,5 (faixa 4-5)   e   1,6 N.m ≈ seletor 7 (faixa 6-8)
const SELETOR_MAX = 15;
const SELETOR_PONTO_1 = { torque: 0.3, seletor: 4.5 };
const SELETOR_PONTO_2 = { torque: 1.6, seletor: 7 };
const TORQUE_MAX_PLANILHA = 1.6; // maior torque que a planilha da linha cobre

//CÁLCULO
function seletorPorTorque(torque) {
  const { torque: t1, seletor: s1 } = SELETOR_PONTO_1;
  const { torque: t2, seletor: s2 } = SELETOR_PONTO_2;
  const bruto = s1 + ((s2 - s1) / (t2 - t1)) * (torque - t1);
  const centro = Math.min(SELETOR_MAX, Math.max(1, bruto));

  const max = Math.min(SELETOR_MAX, Math.round(centro + 0.5));
  let min = Math.max(1, Math.round(centro - 0.5));
  if (min >= max) min = Math.max(1, max - 1);
  return { min, max, acimaDoLimite: bruto > SELETOR_MAX };
}

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

  const bruto = Math.min(tChapa, tParafuso);
  const torque = Math.max(0.1, Math.round(bruto * 10) / 10);
  const { min, max, acimaDoLimite } = seletorPorTorque(bruto);
  return {
    torque,
    min,
    max,
    acimaDoLimite,
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
  const parafuso = usar ? acharParafuso($("op3").value) : null;
  const diametro = parafuso ? parafuso.diametro : DIAMETRO_PADRAO;
  const esp1 = lerEspessura("esp1");
  const esp2 = lerEspessura("esp2");

  const r = calcularTorque(
    $("op1").value,
    esp1,
    $("op2").value,
    esp2,
    diametro,
  );

  $("valor").textContent = formatar(r.torque);
  $("min").textContent = r.min;
  $("max").textContent = r.max;
  $("m1").textContent = nomeSelecionado("op1");
  $("m2").textContent = nomeSelecionado("op2");
  $("parafuso").textContent = parafuso
    ? `parafuso ${parafuso.codigo} (${parafuso.descricao})`
    : `parafuso de ${formatar(DIAMETRO_PADRAO)} mm (padrão)`;

  const avisos = [
    r.limitadoPeloParafuso
      ? "Limite: resistência do parafuso."
      : "Limite: resistência das chapas.",
  ];
  if (parafuso) {
    avisos.push(
      `${parafuso.tipo}, Ø ${parafuso.diametro} mm, comprimento ${parafuso.comprimento} mm.`,
    );
    if (esp1 && esp2 && esp1 + esp2 > parafuso.comprimento) {
      avisos.push(
        "Atenção: as chapas somam mais que o comprimento do parafuso.",
      );
    }
  }
  if (r.espessuraAssumida) {
    avisos.push(`Espessura não informada: assumido ${ESPESSURA_PADRAO} mm.`);
  }
  if (r.acimaDoLimite) {
    avisos.push(
      `Torque acima da capacidade da parafusadeira (seletor ${SELETOR_MAX}).`,
    );
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

// Monta as opções do select de parafusos a partir da lista PARAFUSOS
$("op3").innerHTML = PARAFUSOS.map(
  (p) => `<option value="${p.codigo}">${p.codigo} - ${p.descricao}</option>`,
).join("");

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
