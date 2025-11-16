from flask import Flask, render_template, request, jsonify
from dag_engine import DagEngine
import sentiment_flow

app = Flask(__name__)
engine = DagEngine()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/analyze", methods=["POST"])
def analyze():
    text = request.json.get("text", "")
    results = engine.run({"text": text})
    return jsonify({
        "sentiment": results["SentimentAI"],
        "propagation": results["Propagation"],
        "global": results["GlobalEmotion"]
    })


if __name__ == "__main__":
    app.run(debug=True)
