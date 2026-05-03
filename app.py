import os
import socket
from datetime import datetime
from flask import Flask, render_template, jsonify

app = Flask(__name__)

DEPLOYMENT_VERSION = os.environ.get("DEPLOYMENT_VERSION", "blue").lower()
BUILD_NUMBER = os.environ.get("BUILD_NUMBER", "local")
HOSTNAME = socket.gethostname()


def context():
    return {
        "version": DEPLOYMENT_VERSION,
        "build": BUILD_NUMBER,
        "host": HOSTNAME,
        "year": datetime.utcnow().year,
    }


@app.route("/")
def home():
    return render_template("index.html", page="home", **context())


@app.route("/products")
def products():
    items = [
        {"name": "Kubernetes Cluster", "price": "$199/mo", "icon": "bi-diagram-3", "desc": "Managed K8s with autoscaling and observability built in."},
        {"name": "CI/CD Pipeline", "price": "$49/mo", "icon": "bi-arrow-repeat", "desc": "Jenkins-powered pipelines with blue-green and canary support."},
        {"name": "Container Registry", "price": "$19/mo", "icon": "bi-box-seam", "desc": "Private Docker registry with vulnerability scanning."},
        {"name": "Monitoring Stack", "price": "$29/mo", "icon": "bi-activity", "desc": "Prometheus + Grafana dashboards out of the box."},
        {"name": "Log Aggregation", "price": "$25/mo", "icon": "bi-journal-text", "desc": "Centralized logs with full-text search and alerting."},
        {"name": "Secrets Vault", "price": "$15/mo", "icon": "bi-shield-lock", "desc": "Encrypted secret storage with fine-grained access control."},
    ]
    return render_template("products.html", page="products", items=items, **context())


@app.route("/contact")
def contact():
    return render_template("contact.html", page="contact", **context())


@app.route("/version")
def version():
    return jsonify({"version": DEPLOYMENT_VERSION, "build": BUILD_NUMBER, "host": HOSTNAME})


@app.route("/healthz")
def healthz():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
