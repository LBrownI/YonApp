from flask import Blueprint, request, jsonify

careers_bp = Blueprint('careers', __name__)

# --- BASE DE DATOS DE CARRERAS (Simulada en Memoria) ---
# Aquí se guardarán las configuraciones que hagas en el modal.
CAREER_DATABASE = {
    "ENFE": {
        "nombre": "Enfermería",
        "semestres": 10,
        "mallas": ["2019", "2024"]
    },
    "KINE": {
        "nombre": "Kinesiología",
        "semestres": 10,
        "mallas": ["2020"]
    }
}

@careers_bp.route("/get_careers", methods=["GET"])
def get_careers():
    """Devuelve la lista de carreras configuradas"""
    return jsonify({"success": True, "data": CAREER_DATABASE})

@careers_bp.route("/save_career", methods=["POST"])
def save_career():
    """Crea o actualiza una carrera desde el modal"""
    data = request.json
    code = data.get("code", "").strip().upper()
    name = data.get("name", "").strip()
    
    try:
        semesters = int(data.get("semesters", 10))
    except:
        semesters = 10
        
    meshes = data.get("meshes", []) # Viene como lista desde el JS

    if not code or not name:
        return jsonify({"error": "Faltan datos obligatorios"}), 400

    CAREER_DATABASE[code] = {
        "nombre": name,
        "semestres": semesters,
        "mallas": meshes
    }
    return jsonify({"success": True, "data": CAREER_DATABASE})

@careers_bp.route("/delete_career", methods=["POST"])
def delete_career():
    data = request.json
    code = data.get("code")
    if code in CAREER_DATABASE:
        del CAREER_DATABASE[code]
        return jsonify({"success": True})
    return jsonify({"error": "Carrera no encontrada"}), 404
