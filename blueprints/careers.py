from flask import Blueprint, request, jsonify

careers_bp = Blueprint("careers", __name__)

# --- BASE DE DATOS DE CARRERAS ---
CAREER_DATABASE = {
    "ENFE": {
        "nombre": "Enfermería",
        "semestres": 10,
        "mallas": ["2019", "2024"],
        "planificacion": [],
    },
    "KINE": {
        "nombre": "Kinesiología",
        "semestres": 10,
        "mallas": ["2020"],
        "planificacion": [],
    },
}


@careers_bp.route("/get_careers", methods=["GET"])
def get_careers():
    return jsonify({"success": True, "data": CAREER_DATABASE})


@careers_bp.route("/save_career", methods=["POST"])
def save_career():
    data = request.json
    code = data.get("code", "").strip().upper()
    name = data.get("name", "").strip()
    try:
        semesters = int(data.get("semesters", 10))
    except:
        semesters = 10
    meshes = data.get("meshes", [])

    if not code or not name:
        return jsonify({"error": "Faltan datos"}), 400

    existing_plan = []
    if code in CAREER_DATABASE:
        existing_plan = CAREER_DATABASE[code].get("planificacion", [])

    CAREER_DATABASE[code] = {
        "nombre": name,
        "semestres": semesters,
        "mallas": meshes,
        "planificacion": existing_plan,
    }
    return jsonify({"success": True, "data": CAREER_DATABASE})


@careers_bp.route("/delete_career", methods=["POST"])
def delete_career():
    data = request.json
    code = data.get("code")
    if code in CAREER_DATABASE:
        del CAREER_DATABASE[code]
        return jsonify({"success": True})
    return jsonify({"error": "No encontrada"}), 404


# --- RUTA MODIFICADA: SIN NOMBRE DE ASIGNATURA ---
@careers_bp.route("/add_block", methods=["POST"])
def add_block():
    data = request.json
    code = data.get("career_code")

    if code not in CAREER_DATABASE:
        return jsonify({"error": "Carrera no encontrada"}), 404

    new_block = {
        "malla": data.get("malla"),
        "semestre": data.get("semestre"),
        "dia": data.get("dia"),
        "modulo": int(data.get("modulo")),
        # Eliminamos 'asignatura' (nombre), nos basamos en NRC/Sección
        "nrc": data.get("nrc"),
        "seccion": data.get("seccion"),
        "tipo": data.get("tipo"),
    }

    CAREER_DATABASE[code]["planificacion"].append(new_block)

    return jsonify({"success": True, "data": CAREER_DATABASE})
