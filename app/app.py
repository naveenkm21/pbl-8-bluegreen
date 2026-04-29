from flask import Flask, jsonify
import os

app = Flask(__name__)

COLOR = os.getenv("APP_COLOR", "blue")
VERSION = os.getenv("APP_VERSION", "v1")

@app.route("/")
def home():
    return jsonify(
        message=f"PBL-8 Blue-Green demo — serving from {COLOR} environment",
        color=COLOR,
        version=VERSION,
        host=os.getenv("HOSTNAME", "unknown"),
    )

@app.route("/health")
def health():
    return jsonify(status="ok", color=COLOR), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
