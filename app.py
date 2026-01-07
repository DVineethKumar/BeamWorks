from flask import Flask, render_template, request, jsonify
from solver import solve_beam
import os

app = Flask(__name__)


# =====================================================
# HOME
# =====================================================
@app.route("/")
def index():
    return render_template("index.html")


# =====================================================
# SOLVER API
# =====================================================
@app.route("/solve", methods=["POST"])
def solve():
    try:
        data = request.get_json(force=True)

        # ---------------- Beam Type ----------------
        beam_type = data.get("beamType", "simply_supported")

        # ---------------- Beam Properties ----------------
        beam = data.get("beam") or {}

        def safe_float(val, default):
            try:
                return float(val)
            except (TypeError, ValueError):
                return default

        L = safe_float(beam.get("length"), 1.0)
        E = safe_float(beam.get("E"), 210e9)
        I = safe_float(beam.get("I"), 8e-6)

        if L <= 0:
            raise ValueError("Beam length must be positive")

        # ---------------- Loads ----------------
        loads = data.get("loads") or []

        # ---------------- Overhang ----------------
        overhang_length = safe_float(
            data.get("overhangLength"), None
        )

        # ---------------- Solve ----------------
        result = solve_beam(
            beam_type=beam_type,
            L=L,
            loads=loads,
            E=E,
            I=I,
            overhang_length=overhang_length
        )

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =====================================================
# ENTRY POINT (LOCAL ONLY)
# =====================================================
if __name__ == "__main__":
    app.run()
