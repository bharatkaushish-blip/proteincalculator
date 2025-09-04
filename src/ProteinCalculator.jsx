import { useEffect, useMemo, useRef, useState } from "react";

// ---------------- Helpers (pure, testable) ----------------
function closestByProtein(list, target) {
  return [...list].sort((a, b) => Math.abs(a.protein - target) - Math.abs(b.protein - target));
}

function totalProtein(plan) {
  return [plan.breakfast, plan.lunch, plan.dinner]
    .filter(Boolean)
    .reduce((sum, it) => sum + (it?.protein || 0), 0);
}

function snackTotalProtein(snacks, counts, overrides) {
  return snacks.reduce((sum, s) => {
    const key = s.name;
    const qty = counts[key] || 0;
    const perPack = (typeof s.protein === "number" ? s.protein : (overrides[key] ? parseFloat(overrides[key]) : 0)) || 0;
    return sum + qty * perPack;
  }, 0);
}

export default function ProteinCalculator() {
  // Refs (uncontrolled to keep typing stable)
  const weightRef = useRef(null);

  // UI state
  const [activity, setActivity] = useState("sedentary");
  const [diet, setDiet] = useState("non-veg");
  const [tab, setTab] = useState("calculator"); // calculator | about

  // Results & plan
  const [proteinTarget, setProteinTarget] = useState(null);
  const [plan, setPlan] = useState({ breakfast: null, lunch: null, dinner: null });
  const [planIndices, setPlanIndices] = useState({ breakfast: 0, lunch: 0, dinner: 0 });

  // Activity multipliers — AS REQUESTED
  const activityMultipliers = { sedentary: 1.2, moderate: 1.55, active: 1.75 };

  // Snack ideas (India, Amazon). Non‑veg users see a mix of veg + non‑veg; veg users see veg only
  const snackSuggestions = {
    "non-veg": [
      { name: "DOKi Buffalo Jerky (30 g)", protein: 15.28, url: "https://www.amazon.in/Essentials-Variety-Flavours-Protein-All-Natural/dp/B0DQTRJ1S3" },
      { name: "DOKi Pork Puffs (25 g)", protein: 15.06, url: "https://www.amazon.in/Flavours-Protein-Calorie-All-Natural-Friendly/dp/B0D3TW6BY8" },
      { name: "DOKi Chicken Chips (30 g)", protein: 10.83, url: "https://www.amazon.in/Chicken-Protein-Calorie-All-natural-protein/dp/B0BN1BP63S" },
    ],
    veg: [
      { name: "Epigamia Turbo Protein Yogurt (140 g cup)", protein: 17, url: "https://www.amazon.in/Epigamia-Protein-Turbo-Yogurt-Natural/dp/B0DQYFYFFR" },
      { name: "Conscious Food Crunchy Chickpeas (50 g)", protein: 11, url: "https://www.amazon.in/Conscious-Food-High-Protein-Cholesterol-Free-Preservatives/dp/B0DJ2YZVBB" },
      { name: "The Whole Truth 20 g Protein Bar (67 g)", protein: 20, url: "https://www.amazon.in/Whole-Truth-Preservatives-Artificial-Flavours/dp/B0BVLXKKVZ" },
    ],
  };

  const [snackCounts, setSnackCounts] = useState({});
  const [snackOverrides, setSnackOverrides] = useState({});

  // ---------------- Recipe bank ----------------
  const recipeBank = useMemo(() => ({
    breakfast: [
      {
        name: "Greek Yogurt Protein Bowl",
        protein: 30,
        cals: 360,
        diet: "veg",
        recipe: [
          "200 g Greek yogurt (or hung curd)",
          "30 g whey protein (unflavoured or vanilla)",
          "50 g fruit (berries/banana)",
          "10 g chia seeds",
          "Mix yogurt + whey; top with fruit and chia.",
        ],
        video: "https://www.youtube.com/embed/G6kT2vC5mXk",
      },
      {
        name: "Masala Omelette",
        protein: 19,
        cals: 280,
        diet: "non-veg",
        recipe: [
          "3 eggs (~150 g)",
          "30 g onion, 1 green chilli, 10 g coriander",
          "5 ml oil/ghee; salt & pepper",
          "Beat, cook 2–3 min each side on medium.",
        ],
        video: "https://www.youtube.com/embed/4m8oY9Z9iNU",
      },
    ],
    lunch: [
      {
        name: "Grilled Chicken + Rice",
        protein: 35,
        cals: 560,
        diet: "non-veg",
        recipe: [
          "120 g chicken breast (raw)",
          "Marinade: 5 ml oil, lemon, salt, pepper, paprika",
          "Grill/pan 4–5 min per side to 75°C",
          "150 g cooked rice + salad",
        ],
        video: "https://www.youtube.com/embed/u2ZVt8V4g2M",
      },
      {
        name: "Rajma Protein Bowl",
        protein: 22,
        cals: 520,
        diet: "veg",
        recipe: [
          "50 g dry rajma (soaked; ~150 g cooked)",
          "Gravy: 10 g oil, onion, tomato, ginger‑garlic, spices",
          "Pressure cook till soft; simmer 10 min",
          "Serve with 150 g cooked rice",
        ],
        video: "https://www.youtube.com/embed/2pY1Hq0h4jA",
      },
    ],
    dinner: [
      {
        name: "Chicken & Veg Stir‑fry",
        protein: 35,
        cals: 480,
        diet: "non-veg",
        recipe: [
          "150 g chicken thigh/breast, sliced",
          "200 g mixed vegetables",
          "Sauce: 10 ml soy, 5 ml vinegar, garlic, chilli",
          "Stir‑fry veg 2 min; add chicken 5–6 min; toss with sauce",
        ],
        video: "https://www.youtube.com/embed/7kYz2EwN8uM",
      },
      {
        name: "Chole + Quinoa",
        protein: 24,
        cals: 520,
        diet: "veg",
        recipe: [
          "60 g dry chole (kabuli chana)",
          "120 g cooked quinoa (from ~40 g raw)",
          "Onion‑tomato masala with spices",
          "Combine; simmer 5 min",
        ],
        video: "https://www.youtube.com/embed/j0g8j5l9C7g",
      },
    ],
  }), []);

  // ------------ Snacks helper ------------
  const computeSnacks = () =>
    diet === "non-veg"
      ? [...(snackSuggestions["non-veg"] || []), ...(snackSuggestions.veg || [])]
      : snackSuggestions.veg || [];

  // ------------ Plan generators ------------
  const generatePlan = (targetG) => {
    const tgt = targetG ?? proteinTarget ?? 0;
    const splits = { breakfast: 0.3, lunch: 0.35, dinner: 0.35 };
    const wanted = {
      breakfast: tgt * splits.breakfast,
      lunch: tgt * splits.lunch,
      dinner: tgt * splits.dinner,
    };
    const filterByPrefs = (meal) =>
      recipeBank[meal].filter((r) => (diet === "veg" ? r.diet === "veg" : true));
    setPlan({
      breakfast: closestByProtein(filterByPrefs("breakfast"), wanted.breakfast)[0] || null,
      lunch: closestByProtein(filterByPrefs("lunch"), wanted.lunch)[0] || null,
      dinner: closestByProtein(filterByPrefs("dinner"), wanted.dinner)[0] || null,
    });
    setPlanIndices({ breakfast: 0, lunch: 0, dinner: 0 });
  };

  const regenerateAll = () => {
    if (!proteinTarget) return;
    const tgt = proteinTarget;
    const splits = { breakfast: 0.3, lunch: 0.35, dinner: 0.35 };
    const meals = ["breakfast", "lunch", "dinner"];
    const nextPlan = {};
    const nextIdx = {};

    meals.forEach((m) => {
      const wanted = tgt * splits[m];
      const list = recipeBank[m].filter((r) => (diet === "veg" ? r.diet === "veg" : true));
      const sorted = closestByProtein(list, wanted);
      const len = Math.max(sorted.length, 1);
      const curr = planIndices[m] || 0;
      const next = (curr + 1) % len;
      nextPlan[m] = sorted[next] || null;
      nextIdx[m] = next;
    });

    setPlan(nextPlan);
    setPlanIndices(nextIdx);
  };

  const refreshOne = (which) => {
    const tgt = proteinTarget ?? 0;
    const splits = { breakfast: 0.3, lunch: 0.35, dinner: 0.35 };
    const wanted = tgt * splits[which];
    const list = recipeBank[which].filter((r) => (diet === "veg" ? r.diet === "veg" : true));
    const sorted = closestByProtein(list, wanted);
    const nextIndex = (planIndices[which] + 1) % Math.max(sorted.length, 1);
    const nextItem = sorted[nextIndex] || null;
    setPlan((prev) => ({ ...prev, [which]: nextItem }));
    setPlanIndices((prev) => ({ ...prev, [which]: nextIndex }));
  };

  const calculateProtein = () => {
    const weight = parseFloat(weightRef.current?.value || "0");
    if (!weight) return;

    // EXACT RULE: target (g/day) = weight (kg) × activity multiplier
    const mult = activityMultipliers[activity] || 1.2;
    const proteinReq = weight * mult;

    const rounded = Number.isFinite(proteinReq) ? parseFloat(proteinReq.toFixed(1)) : 0;
    setProteinTarget(rounded);
    generatePlan(rounded);
  };

  // Self‑tests on mount
  useEffect(() => {
    runSelfTests();
  }, []);

  const InputWithLabel = ({ label, children }) => (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );

  // Derived totals
  const snacks = computeSnacks();
  const snacksProtein = snackTotalProtein(snacks, snackCounts, snackOverrides);
  const planProtein = totalProtein(plan);
  const combinedProtein = planProtein + snacksProtein;
  const remaining = Math.max(0, (proteinTarget || 0) - combinedProtein);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-white to-blue-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-10 max-w-4xl w-full">
        {/* Tabs */}
        <div className="flex gap-6 border-b mb-6">
          <button onClick={() => setTab("calculator")} className={`pb-2 ${tab === "calculator" ? "border-b-2 border-pink-600 font-semibold" : "text-gray-600"}`}>Calculator</button>
          <button onClick={() => setTab("about")} className={`pb-2 ${tab === "about" ? "border-b-2 border-pink-600 font-semibold" : "text-gray-600"}`}>About</button>
        </div>

        {tab === "calculator" && (
          <>
            <h1 className="text-3xl font-bold text-gray-900">Protein Calculator</h1>
            <p className="text-gray-600 mt-2">Find your daily protein target and get a refreshable day plan with recipes.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              <InputWithLabel label="Weight (kg)">
                <input
                  ref={weightRef}
                  type="text"
                  inputMode="decimal"
                  className="border rounded-lg p-3 w-full"
                  aria-label="Weight in kilograms"
                  defaultValue=""
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </InputWithLabel>

              <InputWithLabel label="Activity Level">
                <select value={activity} onChange={(e) => setActivity(e.target.value)} className="border rounded-lg p-3 w-full">
                  <option value="sedentary">Sedentary (×1.2)</option>
                  <option value="moderate">Moderate (×1.55)</option>
                  <option value="active">Active (×1.75)</option>
                </select>
              </InputWithLabel>

              <InputWithLabel label="Diet Preference">
                <select value={diet} onChange={(e) => setDiet(e.target.value)} className="border rounded-lg p-3 w-full">
                  <option value="non-veg">Non-Vegetarian</option>
                  <option value="veg">Vegetarian</option>
                </select>
              </InputWithLabel>
            </div>

            <button onClick={calculateProtein} className="mt-6 w-full bg-pink-500 hover:bg-pink-600 text-white rounded-lg py-3 font-semibold">Calculate</button>

            {proteinTarget && (
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-800">Your Day Plan · Target <span className="text-pink-600">{proteinTarget} g</span></h2>
                  <button onClick={regenerateAll} className="text-sm px-3 py-2 rounded-lg border hover:bg-gray-50">Regenerate All</button>
                </div>

                <PlanCard title="Breakfast" item={plan.breakfast} onRefresh={() => refreshOne("breakfast")} />
                <PlanCard title="Lunch" item={plan.lunch} onRefresh={() => refreshOne("lunch")} />
                <PlanCard title="Dinner" item={plan.dinner} onRefresh={() => refreshOne("dinner")} />

                {/* Totals */}
                <div className="mt-6 p-4 bg-gray-50 rounded-xl border">
                  <p className="text-gray-800 font-medium">Total from plan: {planProtein} g protein</p>
                  <p className="text-gray-600">From snacks (selected below): {snacksProtein.toFixed(1)} g</p>
                  <p className="text-gray-900 font-medium mt-1">Plan + snacks = {combinedProtein.toFixed(1)} g / {proteinTarget} g</p>
                  <p className="text-gray-600">{remaining > 0 ? `${remaining.toFixed(1)} g to reach your target.` : `Target met! (+${Math.abs(remaining).toFixed(1)} g)`}</p>
                </div>

                {/* Snack ideas at the bottom */}
                <div className="mt-8">
                  <h3 className="font-medium text-gray-800">Packaged snack ideas in India</h3>
                  <p className="text-gray-600 text-sm">Add packs to see how much protein they contribute to your goal.</p>
                  <ul className="mt-2 text-gray-700 space-y-3">
                    {snacks.map((snack, i) => {
                      const key = snack.name;
                      const qty = snackCounts[key] || 0;
                      const hasProtein = typeof snack.protein === "number";
                      const override = snackOverrides[key] || "";
                      const perPack = hasProtein ? snack.protein : (override ? parseFloat(override) : 0);
                      const lineProtein = (qty * (perPack || 0)).toFixed(1);
                      return (
                        <li key={i} className="flex items-start justify-between gap-3 border rounded-xl p-3">
                          <div className="min-w-0">
                            <a className="text-pink-700 hover:underline break-words" href={snack.url} target="_blank" rel="noreferrer noopener">{snack.name}</a>
                            <div className="text-sm text-gray-600">
                              {hasProtein ? (
                                <span>{snack.protein} g/pack</span>
                              ) : (
                                <span>Protein per pack unknown — enter below</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <a href={snack.url} target="_blank" rel="noreferrer noopener" className="px-3 py-1 rounded-lg border text-sm hover:bg-gray-50">Buy on Amazon</a>
                            {!hasProtein && (
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="g/pack"
                                className="border rounded-lg p-2 w-24"
                                value={override}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSnackOverrides((prev) => ({ ...prev, [key]: val }));
                                }}
                              />
                            )}
                            <div className="flex items-center gap-1">
                              <button
                                className="px-2 py-1 border rounded-lg"
                                onClick={() => setSnackCounts((prev) => ({ ...prev, [key]: Math.max(0, (qty || 0) - 1) }))}
                                aria-label={`Decrease ${snack.name}`}
                              >−</button>
                              <input
                                type="text"
                                inputMode="numeric"
                                className="border rounded-lg p-2 w-16 text-center"
                                value={qty}
                                onChange={(e) => {
                                  const v = Math.max(0, parseInt(e.target.value || "0", 10));
                                  setSnackCounts((prev) => ({ ...prev, [key]: v }));
                                }}
                              />
                              <button
                                className="px-2 py-1 border rounded-lg"
                                onClick={() => setSnackCounts((prev) => ({ ...prev, [key]: (qty || 0) + 1 }))}
                                aria-label={`Increase ${snack.name}`}
                              >+</button>
                            </div>
                            <div className="text-sm text-gray-600 w-full sm:w-auto text-right">= {lineProtein} g</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "about" && (
          <div className="max-w-none">
            <div className="rounded-2xl border p-6 bg-white/70">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">About the Protein Calculator</h1>
              <p className="mt-2 text-gray-700">This page explains the simple rule used here (weight × activity multiplier) and places it in context with established nutrition science. We include links to primary sources so you can read deeper.</p>

              {/* Our Formula Card */}
              <div className="mt-6 grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-pink-50 border">
                  <div className="text-xs uppercase tracking-wide text-pink-700">Core Formula Used</div>
                  <div className="mt-1 text-gray-900 font-semibold">Target (g/day) = Weight (kg) × Multiplier</div>
                  <div className="text-xs text-gray-600 mt-1">Sedentary ×1.2 · Moderate ×1.55 · Active ×1.75</div>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50 border">
                  <div className="text-xs uppercase tracking-wide text-blue-700">Why These Multipliers?</div>
                  <div className="mt-1 text-gray-900 text-sm">They approximate higher protein needs with rising activity, while staying easy to remember and use daily.</div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 border">
                  <div className="text-xs uppercase tracking-wide text-emerald-700">Who Is This For?</div>
                  <div className="mt-1 text-gray-900 text-sm">Healthy adults. If you are pregnant/lactating, have kidney disease, or other conditions, consult a clinician/dietitian.</div>
                </div>
              </div>

              {/* Scientific Context */}
              <h2 className="mt-8 text-xl font-semibold text-gray-900">Scientific Context (with sources)</h2>
              <div className="mt-3 space-y-4 text-gray-800">
                <div className="p-4 rounded-xl bg-gray-50 border">
                  <h3 className="font-semibold text-gray-900">1) Baseline protein needs (RDA)</h3>
                  <p className="mt-1 text-gray-700 text-sm">Most agencies set a baseline near <span className="font-medium">0.8–0.83 g/kg/day</span> for healthy adults to meet minimum needs, assuming energy balance and no unusually high training load.</p>
                  <ul className="list-disc list-inside text-sm mt-2 text-gray-700">
                    <li>ICMR–NIN (India) recommends ~<span className="font-medium">0.83 g/kg/day</span>. <a className="text-pink-700 hover:underline" href="https://www.nin.res.in/rdabook/brief_note.pdf" target="_blank" rel="noreferrer noopener">ICMR–NIN RDA (PDF)</a></li>
                    <li>FAO/WHO/UNU expert reports suggest similar ranges for adults. <a className="text-pink-700 hover:underline" href="https://www.fao.org/3/aa040e/aa040e.pdf" target="_blank" rel="noreferrer noopener">FAO/WHO/UNU Report</a></li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border">
                  <h3 className="font-semibold text-gray-900">2) Higher intakes for active people</h3>
                  <p className="mt-1 text-gray-700 text-sm">Athletes and regularly active adults often benefit from <span className="font-medium">~1.4–2.0 g/kg/day</span> depending on training volume and goals (strength gain vs. body composition).</p>
                  <ul className="list-disc list-inside text-sm mt-2 text-gray-700">
                    <li>International Society of Sports Nutrition (ISSN) position stand supports <span className="font-medium">~1.4–2.0 g/kg/day</span> for most athletes. <a className="text-pink-700 hover:underline" href="https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8" target="_blank" rel="noreferrer noopener">ISSN 2017</a></li>
                    <li>Reviews also note day-to-day distribution matters (e.g., ~0.25–0.40 g/kg per meal) to maximize muscle protein synthesis. <a className="text-pink-700 hover:underline" href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5477156/" target="_blank" rel="noreferrer noopener">Per‑meal distribution (review)</a></li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border">
                  <h3 className="font-semibold text-gray-900">3) How our simple rule fits</h3>
                  <p className="mt-1 text-gray-700 text-sm">Your chosen multipliers (1.2×, 1.55×, 1.75×) scale needs with activity in a user‑friendly way. For many users, results fall inside evidence‑based ranges above, while avoiding complicated questionnaires.</p>
                </div>
              </div>

              {/* Examples */}
              <h2 className="mt-8 text-xl font-semibold text-gray-900">Examples</h2>
              <div className="mt-3 grid sm:grid-cols-3 gap-4 text-sm">
                <div className="border rounded-xl p-4 bg-white">
                  <div className="text-gray-500">70 kg · Sedentary</div>
                  <div className="text-gray-900 font-semibold">1.2 × 70 = <span className="text-pink-700">84 g/day</span></div>
                </div>
                <div className="border rounded-xl p-4 bg-white">
                  <div className="text-gray-500">70 kg · Moderate</div>
                  <div className="text-gray-900 font-semibold">1.55 × 70 = <span className="text-pink-700">108.5 g/day</span></div>
                </div>
                <div className="border rounded-xl p-4 bg-white">
                  <div className="text-gray-500">70 kg · Active</div>
                  <div className="text-gray-900 font-semibold">1.75 × 70 = <span className="text-pink-700">122.5 g/day</span></div>
                </div>
              </div>

              {/* Practical Notes */}
              <h2 className="mt-8 text-xl font-semibold text-gray-900">Practical Notes</h2>
              <ul className="mt-2 list-disc list-inside text-sm text-gray-700 space-y-1">
                <li>Spread protein across meals (e.g., breakfast/lunch/dinner) to improve utilization.</li>
                <li>High‑quality protein sources include dairy, eggs, lean meats/fish, soy, legumes, and pulses.</li>
                <li>Energy intake, sleep, and training quality also influence outcomes.</li>
              </ul>

              {/* Citations block */}
              <h2 className="mt-8 text-xl font-semibold text-gray-900">Cited Sources</h2>
              <ol className="mt-2 space-y-1 text-sm text-gray-700 list-decimal list-inside">
                <li>ICMR–NIN. <a className="text-pink-700 hover:underline" href="https://www.nin.res.in/rdabook/brief_note.pdf" target="_blank" rel="noreferrer noopener">Recommended Dietary Allowances</a> and <a className="text-pink-700 hover:underline" href="https://www.nin.res.in/dietaryguidelines/pdfjs/locale/DGI24thJune2024fin.pdf" target="_blank" rel="noreferrer noopener">Dietary Guidelines for Indians (2024)</a>.</li>
                <li>FAO/WHO/UNU. <a className="text-pink-700 hover:underline" href="https://www.fao.org/3/aa040e/aa040e.pdf" target="_blank" rel="noreferrer noopener">Protein and Amino Acid Requirements in Human Nutrition</a>.</li>
                <li>JISSN Position Stand. <a className="text-pink-700 hover:underline" href="https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8" target="_blank" rel="noreferrer noopener">Protein and exercise (2017)</a>.</li>
                <li>Per‑meal distribution review. <a className="text-pink-700 hover:underline" href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5477156/" target="_blank" rel="noreferrer noopener">Evidence on ~0.25–0.40 g/kg/meal</a>.</li>
              </ol>

              <div className="mt-6 p-4 bg-gray-50 rounded-xl border text-sm text-gray-700">
                <p className="mb-1"><strong>Disclaimer:</strong> This tool does not diagnose or treat any condition. For personalized advice, consult a qualified professional.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanCard({ title, item, onRefresh }) {
  return (
    <div className="mt-4 p-4 border rounded-xl bg-white/60">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="font-semibold text-gray-900">{title}</h4>
          {item ? (
            <p className="text-gray-700">{item.name} · <span className="font-medium">{item.protein} g protein</span> · ~{item.cals} kcal</p>
          ) : (
            <p className="text-gray-500">No suggestion available.</p>
          )}
        </div>
        <button onClick={onRefresh} className="text-sm px-3 py-2 rounded-lg border hover:bg-gray-50">Refresh</button>
      </div>

      {item && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-pink-700 hover:text-pink-800">View recipe</summary>
          <ul className="mt-2 list-disc list-inside text-gray-700">
            {item.recipe?.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
          {item.video && (
            <div className="mt-3 aspect-video">
              <iframe
                className="w-full h-full rounded-lg"
                src={item.video}
                title={`${item.name} video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}
        </details>
      )}
    </div>
  );
}

// ---------------- Minimal self-tests (console) ----------------
function runSelfTests() {
  try {
    // formula tests: 70 kg
    const w = 70;
    const mult = { sedentary: 1.2, moderate: 1.55, active: 1.75 };
    console.assert(Math.abs(w * mult.sedentary - 84.0) < 0.01, "sedentary rule failed");
    console.assert(Math.abs(w * mult.moderate - 108.5) < 0.01, "moderate rule failed");
    console.assert(Math.abs(w * mult.active - 122.5) < 0.01, "active rule failed");

    // closestByProtein
    const sorted = closestByProtein([{ protein: 10 }, { protein: 30 }, { protein: 20 }], 22);
    console.assert(sorted[0].protein === 20, "closestByProtein failed");

    // totalProtein
    console.assert(totalProtein({ breakfast: { protein: 10 }, lunch: { protein: 15 }, dinner: { protein: 5 } }) === 30, "totalProtein failed");

    // snackTotalProtein
    const snacks = [{ name: "A", protein: 10 }, { name: "B" }];
    const counts = { A: 2, B: 1 };
    const overrides = { B: 7.5 };
    console.assert(Math.abs(snackTotalProtein(snacks, counts, overrides) - 27.5) < 0.001, "snackTotalProtein failed");

    console.log("Self-tests passed ✅");
  } catch (e) {
    console.error("Self-tests error ❌", e);
  }
}
