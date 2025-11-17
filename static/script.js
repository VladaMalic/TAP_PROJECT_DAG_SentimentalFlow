document.addEventListener("DOMContentLoaded", () => {

    // ============================================================
    // 🔧 BACKGROUND UTILS
    // ============================================================

    function clearAllBackgrounds() {
        document.body.classList.remove(
            "bg-positive", "bg-negative", "bg-neutral",
            "bg-split", "bg-river"
        );
        document.body.style.background = "#ffffff";
    }

    function colorFromLabel(label) {
        if (label === "Pozitiv") return "#e8fff0";   // verde pastel
        if (label === "Negativ") return "#ffe5e5";   // roșu pastel
        return "#eef1ff";                             // albastru pastel
    }

    function setSingleBackground(label) {
        clearAllBackgrounds();

        if (label === "Pozitiv") document.body.classList.add("bg-positive");
        else if (label === "Negativ") document.body.classList.add("bg-negative");
        else document.body.classList.add("bg-neutral");
    }

function setComparisonBackground(label1, label2) {
    const c1 = colorFromLabel(label1);
    const c2 = colorFromLabel(label2);

    document.body.className = "bg-compare";
    document.body.style.background = `linear-gradient(to right, ${c1} 0%, ${c2} 100%)`;
}


    function setRiverBackground(avgPos, avgNeu, avgNeg) {
        clearAllBackgrounds();

        const top = colorFromLabel(
            avgPos >= avgNeg && avgPos >= avgNeu ? "Pozitiv" :
            avgNeg >= avgPos && avgNeg >= avgNeu ? "Negativ" :
            "Neutru"
        );

        document.body.classList.add("bg-river");
        document.body.style.background =
            `linear-gradient(to bottom, ${top}, #ffffff)`;
    }

    // ============================================================
    // TAB SWITCHING
    // ============================================================

    document.querySelectorAll(".tab").forEach(tab => {
        tab.addEventListener("click", () => {

            clearAllBackgrounds();

            const target = tab.getAttribute("data-tab");

            document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

            tab.classList.add("active");
            document.getElementById(target).classList.add("active");
        });
    });

    // ============================================================
    // BACKEND: REAL AI REQUEST
    // ============================================================

    async function analyzeWithBackend(text) {
        const res = await fetch("/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });
        return (await res.json()).sentiment;
    }
function resetBackground() {
    document.body.className = "";
    document.body.style.background = "#ffffff";
}

    // ============================================================
    // BARE CLASICE (Pozitiv / Neutru / Negativ)
    // ============================================================

    function renderBars(scores, container) {
        container.innerHTML = "";

        function add(label, value, cssClass) {
            const row = document.createElement("div");
            row.className = "score-bar";

            row.innerHTML = `
                <div class="score-label">
                    <span>${label}</span>
                    <span>${value.toFixed(1)}%</span>
                </div>
                <div class="bar-container">
                    <div class="bar-fill ${cssClass}" style="width:${value}%"></div>
                </div>
            `;

            container.appendChild(row);
        }

        add("Pozitiv", scores.pozitiv, "bar-positive");
        add("Neutru", scores.neutru, "bar-neutral");
        add("Negativ", scores.negativ, "bar-negative");
    }

    function setBadgeClass(el, label) {
        el.classList.remove("sentiment-positive", "sentiment-negative", "sentiment-neutral");

        if (label === "Pozitiv") el.classList.add("sentiment-positive");
        else if (label === "Negativ") el.classList.add("sentiment-negative");
        else el.classList.add("sentiment-neutral");

        el.textContent = label;
    }

    // ============================================================
    // ⭐ ANALIZA SIMPLĂ
    // ============================================================

    const singleBtn = document.getElementById("singleBtn");
    const singleText = document.getElementById("singleText");
    const singleResult = document.getElementById("singleResult");
    const singleLabel = document.getElementById("singleLabel");
    const singleBars = document.getElementById("singleBars");
    const featureWords = document.getElementById("featureWords");

    singleBtn.addEventListener("click", async () => {
        const txt = singleText.value.trim();
        if (!txt) return alert("Introdu un text!");

        singleBtn.disabled = true;
        singleBtn.textContent = "Analizez...";

        try {
            const sentiment = await analyzeWithBackend(txt);

            setBadgeClass(singleLabel, sentiment.label);
            renderBars(sentiment.scores, singleBars);

            featureWords.textContent =
                "Cuvinte influente: " + (sentiment.features.join(", ") || "N/A");

            singleResult.classList.remove("hidden");

            setSingleBackground(sentiment.label);

        } catch (err) {
            console.error(err);
            alert("Eroare la analiză.");
        } finally {
            singleBtn.disabled = false;
            singleBtn.textContent = "Analizează cu modelul AI";
        }
    });

    // ============================================================
    // ⭐ COMPARAȚIE TEXTE
    // ============================================================

    const compareBtn = document.getElementById("compareBtn");
    const text1 = document.getElementById("text1");
    const text2 = document.getElementById("text2");
    const cmpResults = document.getElementById("comparisonResults");
    const cmpLabel1 = document.getElementById("cmpLabel1");
    const cmpLabel2 = document.getElementById("cmpLabel2");
    const cmpBars1 = document.getElementById("cmpBars1");
    const cmpBars2 = document.getElementById("cmpBars2");

    compareBtn.addEventListener("click", async () => {
        const t1 = text1.value.trim();
        const t2 = text2.value.trim();
        if (!t1 || !t2) return alert("Completează ambele texte!");

        compareBtn.disabled = true;
        compareBtn.textContent = "Analizez...";

        try {
            const [s1, s2] = await Promise.all([
                analyzeWithBackend(t1),
                analyzeWithBackend(t2)
            ]);

            setBadgeClass(cmpLabel1, s1.label);
            setBadgeClass(cmpLabel2, s2.label);

            renderBars(s1.scores, cmpBars1);
            renderBars(s2.scores, cmpBars2);

            cmpResults.classList.remove("hidden");

            setComparisonBackground(s1.label, s2.label);

        } catch (err) {
            console.error(err);
            alert("Eroare la comparație.");
        } finally {
            compareBtn.disabled = false;
            compareBtn.textContent = "Compară sentimentele";
        }
    });

    // ============================================================
    // ⭐ SENTIMENT RIVER
    // ============================================================

    const riverBtn = document.getElementById("riverBtn");
    const riverText = document.getElementById("riverText");
    const riverContainer = document.getElementById("riverContainer");
    const riverDetails = document.getElementById("riverDetails");
    const overallSentiment = document.getElementById("overallSentiment");

    let riverChart;

    riverBtn.addEventListener("click", async () => {
        const txt = riverText.value.trim();
        if (!txt) return alert("Introdu text!");

        const sentences = txt.match(/[^.!?]+[.!?]*/g) || [txt];
        const clean = sentences.map(s => s.trim()).filter(s => s.length > 0);

        riverBtn.disabled = true;
        riverBtn.textContent = "Analizez...";

        try {
            const results = [];

            for (const s of clean) {
                const sentiment = await analyzeWithBackend(s);
                results.push({
                    text: s,
                    label: sentiment.label,
                    scores: sentiment.scores,
                    features: sentiment.features
                });
            }

            const pozitiv = results.map(r => r.scores.pozitiv);
            const neutru = results.map(r => r.scores.neutru);
            const negativ = results.map(r => r.scores.negativ);

            if (riverChart) riverChart.destroy();

            const ctx = document.getElementById("riverChartCanvas").getContext("2d");

            riverChart = new Chart(ctx, {
                type: "line",
                data: {
                    labels: clean.map((_, i) => "P" + (i + 1)),
                    datasets: [
                        {
                            label: "Pozitiv",
                            data: pozitiv,
                            borderColor: "#16a34a",
                            backgroundColor: "rgba(22,163,74,0.2)",
                            tension: 0.4,
                            borderWidth: 3
                        },
                        {
                            label: "Neutru",
                            data: neutru,
                            borderColor: "#64748b",
                            backgroundColor: "rgba(100,116,139,0.2)",
                            tension: 0.4,
                            borderWidth: 3
                        },
                        {
                            label: "Negativ",
                            data: negativ,
                            borderColor: "#dc2626",
                            backgroundColor: "rgba(220,38,38,0.2)",
                            tension: 0.4,
                            borderWidth: 3
                        }
                    ]
                }
            });

            riverDetails.innerHTML = results.map((r, i) => `
                <div class="river-item ${r.label.toLowerCase()}">
                    <strong>P${i + 1}</strong> – ${r.label}<br>
                    <i>${r.text}</i><br>
                    <small>Influente: ${r.features.join(", ")}</small>
                </div>
            `).join("");

            const avgPos = pozitiv.reduce((a, b) => a + b) / pozitiv.length;
            const avgNeg = negativ.reduce((a, b) => a + b) / negativ.length;
            const avgNeu = neutru.reduce((a, b) => a + b) / neutru.length;

            let overall = "Neutru";
            if (avgPos >= avgNeg && avgPos >= avgNeu) overall = "Pozitiv";
            else if (avgNeg >= avgPos && avgNeg >= avgNeu) overall = "Negativ";

            overallSentiment.innerHTML = `
                <b>${overall}</b><br>
                Pozitiv: ${avgPos.toFixed(1)}% ·
                Neutru: ${avgNeu.toFixed(1)}% ·
                Negativ: ${avgNeg.toFixed(1)}%
            `;

            riverContainer.classList.remove("hidden");

            setRiverBackground(avgPos, avgNeu, avgNeg);

        } catch (err) {
            console.error(err);
            alert("Eroare Sentiment River.");
        } finally {
            riverBtn.disabled = false;
            riverBtn.textContent = "Generează Sentiment River";
        }
    });


});
