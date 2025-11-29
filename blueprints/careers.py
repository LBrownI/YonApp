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

# 1 = Primer Semestre (Impares), 2 = Segundo Semestre (Pares)
PLANNING_PERIOD = 1


@careers_bp.route("/get_careers", methods=["GET"])
def get_careers():
    return jsonify(
        {"success": True, "data": CAREER_DATABASE, "period": PLANNING_PERIOD}
    )


@careers_bp.route("/set_planning_period", methods=["POST"])
def set_planning_period():
    global PLANNING_PERIOD
    data = request.json
    period = int(data.get("period", 1))
    if period in [1, 2]:
        PLANNING_PERIOD = period
        return jsonify({"success": True, "period": PLANNING_PERIOD})
    return jsonify({"error": "Periodo inválido"}), 400


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


@careers_bp.route("/edit_block", methods=["POST"])
def edit_block():
    data = request.json
    code = data.get("career_code")
    malla = data.get("malla")
    semestre = data.get("semestre")
    old_dia = data.get("old_dia")
    old_mod = int(data.get("old_modulo"))
    nrc = data.get("nrc")
    seccion = data.get("seccion")
    new_dia = data.get("new_dia") or old_dia
    new_mod = int(data.get("new_modulo")) if data.get("new_modulo") is not None else old_mod
    new_tipo = data.get("new_tipo")  # opcional, por si cambiamos de TEO a LAB, etc.

    career = CAREER_DATABASE.get(code)
    if not career:
        return jsonify({"success": False, "error": "Carrera no encontrada"}), 400

    plan = career.get("planificacion", [])

    # 1) Encontrar el bloque a editar
    target_block = None
    for block in plan:
        if (
            block.get("malla") == malla
            and str(block.get("semestre")) == str(semestre)
            and block.get("dia") == old_dia
            and int(block.get("modulo")) == old_mod
            and str(block.get("nrc")) == str(nrc)
            and block.get("seccion") == seccion
        ):
            target_block = block
            break

    if not target_block:
        return jsonify({"success": False, "error": "Bloque no encontrado"}), 404

    # 2) Determinar tipo resultante (si se cambia)
    resulting_tipo = new_tipo or target_block.get("tipo")

    # 3) Verificar tope: ¿ya existe un bloque del mismo tipo en ese dia/módulo/malla/semestre?
    for block in plan:
        if block is target_block:
            continue
        if (
            block.get("malla") == malla
            and str(block.get("semestre")) == str(semestre)
            and block.get("dia") == new_dia
            and int(block.get("modulo")) == new_mod
            and block.get("tipo") == resulting_tipo
        ):
            return jsonify({
                "success": False,
                "error": "Tope de horario: ya existe un bloque del mismo tipo en ese módulo"
            }), 400

    # 4) Aplicar cambios
    target_block["dia"] = new_dia
    target_block["modulo"] = new_mod
    if new_tipo:
        target_block["tipo"] = new_tipo

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

@careers_bp.route("/delete_planning_block", methods=["POST"])
def delete_planning_block():
    data = request.json
    code = data.get("career_code")
    block_idx = data.get("block_index") # El índice del bloque en la lista (0, 1, 2...)

    if code not in CAREER_DATABASE:
        return jsonify({"error": "Carrera no encontrada"}), 404

    try:
        # Eliminamos el bloque usando su índice en la lista
        career_plan = CAREER_DATABASE[code]["planificacion"]
        if 0 <= block_idx < len(career_plan):
            del career_plan[block_idx]
            return jsonify({"success": True, "data": CAREER_DATABASE})
        else:
            return jsonify({"error": "Índice de bloque inválido"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500