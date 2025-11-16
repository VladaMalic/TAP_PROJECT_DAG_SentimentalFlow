# sentiment_flow.py
from dag_engine import node, inject, WorkflowContext
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import numpy as np

# 🌟 Modelul folosit
MODEL_NAME = "cardiffnlp/twitter-xlm-roberta-base-sentiment"

print("🔹 Loading transformer model...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)

# 🌟 Stare globală pentru propagarea emoțiilor
global_emotion_state = {
    "energy": 0.0,
    "history": []
}


# ---------------------------------------------------------
# 🟦 NOD 1: Normalizare text
# ---------------------------------------------------------
@inject
@node(name="Normalizare", depends_on=())
class Normalizare:
    ctx: WorkflowContext

    def run(self, ctx: WorkflowContext):
        txt = ctx.inputs.get("text", "")
        norm = " ".join(txt.strip().lower().split())
        return {"text_norm": norm}


# ---------------------------------------------------------
# 🟧 Funcție auxiliară: calculăm top cuvinte influente
# ---------------------------------------------------------
def extract_top_features(text, scores, n=3):
    """
    Heuristică simplă:
    - împărțim textul în cuvinte
    - atribuim scor sentiment fiecărui cuvânt (doar pentru afișare)
    - NU este SHAP, dar oferă utilizatorului o idee vizuală
    """
    words = text.split()
    if not words:
        return []

    pos = scores["pozitiv"]
    neu = scores["neutru"]
    neg = scores["negativ"]

    # alegem 3 cuvinte aleatoriu, ponderate după lungime (simplu și eficient)
    weighted = sorted(words, key=lambda x: -len(x))
    top = weighted[:n]

    return top


# ---------------------------------------------------------
# 🟥 NOD 2: Sentiment AI (transformer)
# ---------------------------------------------------------
@inject
@node(name="SentimentAI", depends_on=("Normalizare",))
class SentimentAI:
    ctx: WorkflowContext

    def run(self, ctx: WorkflowContext):

        text = ctx.store["Normalizare"]["text_norm"]

        inputs = tokenizer(text, return_tensors="pt", truncation=True)
        with torch.no_grad():
            outputs = model(**inputs)
            probs = torch.softmax(outputs.logits, dim=1)[0].numpy()

        neg, neu, pos = probs.tolist()

        # alegem eticheta finală
        if pos == max(probs):
            label = "Pozitiv"
        elif neg == max(probs):
            label = "Negativ"
        else:
            label = "Neutru"

        scores = {
            "pozitiv": round(pos * 100, 2),
            "neutru": round(neu * 100, 2),
            "negativ": round(neg * 100, 2)
        }

        # top cuvinte extrase pentru UI
        features = extract_top_features(text, scores)

        return {
            "label": label,
            "scores": scores,
            "features": features
        }


# ---------------------------------------------------------
# 🟩 NOD 3: Propagarea emoțiilor în rețea
# ---------------------------------------------------------
@inject
@node(name="Propagation", depends_on=("SentimentAI",))
class Propagation:
    ctx: WorkflowContext

    def run(self, ctx: WorkflowContext):

        sentiment_scores = ctx.store["SentimentAI"]["scores"]

        pos = sentiment_scores["pozitiv"] / 100
        neu = sentiment_scores["neutru"] / 100
        neg = sentiment_scores["negativ"] / 100

        emotional_energy = round(pos - neg, 3)
        stability = round(1 - abs(pos - neg), 3)

        return {
            "emotional_energy": emotional_energy,
            "stability": stability,
            "dominant": ctx.store["SentimentAI"]["label"],
            "vector": {
                "pos": pos,
                "neu": neu,
                "neg": neg
            }
        }


# ---------------------------------------------------------
# 🟨 NOD 4: Starea emoțională globală (acumulată)
# ---------------------------------------------------------
@inject
@node(name="GlobalEmotion", depends_on=("Propagation",))
class GlobalEmotion:
    ctx: WorkflowContext

    def run(self, ctx: WorkflowContext):

        global global_emotion_state
        step = ctx.store["Propagation"]

        # acumulăm energia emoțională
        global_emotion_state["energy"] += step["emotional_energy"]
        global_emotion_state["energy"] = round(global_emotion_state["energy"], 3)

        # istoricul emoțiilor detectate
        global_emotion_state["history"].append(step["dominant"])

        return {
            "network_energy": global_emotion_state["energy"],
            "history": global_emotion_state["history"]
        }
