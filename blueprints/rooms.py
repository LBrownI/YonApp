import os
from flask import Blueprint, request, jsonify, current_app
import pandas as pd

# Definimos el Blueprint
rooms_bp = Blueprint("rooms", __name__)

# --- BASE DE DATOS DE SALAS (Mantenemos tu lista completa) ---
ROOM_DATABASE = {
    "A102": {"cap": 48, "cat": "Laboratorio"},
    "A210": {"cap": 30, "cat": "Sala"},
    "A302": {"cap": 20, "cat": "Laboratorio"},
    "A302B": {"cap": 10, "cat": "Laboratorio"},
    "A302C": {"cap": 5, "cat": "Laboratorio"},
    "A304": {"cap": 26, "cat": "Lab. Comp"},
    "A312": {"cap": 7, "cat": "Sala"},
    "A313": {"cap": 7, "cat": "Sala"},
    "A314": {"cap": 7, "cat": "Sala"},
    "B102": {"cap": 30, "cat": "Sala"},
    "D104": {"cap": 18, "cat": "Laboratorio"},
    "D106": {"cap": 29, "cat": "Laboratorio"},
    "D107": {"cap": 20, "cat": "Laboratorio"},
    "D108": {"cap": 20, "cat": "Laboratorio"},
    "D109": {"cap": 55, "cat": "Sala"},
    "D110": {"cap": 8, "cat": "Laboratorio"},
    "D201": {"cap": 6, "cat": "Sala de reuniones"},
    "F101": {"cap": 300, "cat": "Gimnasio"},
    "F103": {"cap": 28, "cat": "Laboratorio"},
    "F201": {"cap": 42, "cat": "Sala"},
    "G105": {"cap": 40, "cat": "Taller"},
    "I101A": {"cap": 15, "cat": "Sala"},
    "I101B": {"cap": 15, "cat": "Sala"},
    "I104": {"cap": 50, "cat": "Sala"},
    "I105": {"cap": 20, "cat": "Laboratorio"},
    "I105-B": {"cap": 10, "cat": "Laboratorio"},
    "I106": {"cap": 50, "cat": "Sala"},
    "I108": {"cap": 50, "cat": "Sala"},
    "I202": {"cap": 15, "cat": "Sala"},
    "I204": {"cap": 15, "cat": "Sala"},
    "I206": {"cap": 15, "cat": "Sala"},
    "I210": {"cap": 15, "cat": "Sala"},
    "J101": {"cap": 83, "cat": "Sala"},
    "J102": {"cap": 30, "cat": "Laboratorio"},
    "J201": {"cap": 30, "cat": "Sala"},
    "P203A": {"cap": 21, "cat": "Sala"},
    "P203B": {"cap": 21, "cat": "Sala"},
    "P206A": {"cap": 21, "cat": "Sala"},
    "P206B": {"cap": 21, "cat": "Sala"},
    "P306A": {"cap": 21, "cat": "Sala"},
    "P306B": {"cap": 21, "cat": "Sala"},
    "P307": {"cap": 39, "cat": "Sala Espejo"},
    "P310": {"cap": 10, "cat": "Sala de reuniones"},
    "PS01": {"cap": 8, "cat": "Hospital de Simulación"},
    "PS02": {"cap": 7, "cat": "Hospital de Simulación"},
    "PS03": {"cap": 8, "cat": "Hospital de Simulación"},
    "PS04": {"cap": 7, "cat": "Hospital de Simulación"},
    "PS05": {"cap": 8, "cat": "Hospital de Simulación"},
    "PS06": {"cap": 7, "cat": "Hospital de Simulación"},
    "PS07": {"cap": 12, "cat": "Hospital de Simulación"},
    "PS08": {"cap": 12, "cat": "Hospital de Simulación"},
    "PS09": {"cap": 12, "cat": "Hospital de Simulación"},
    "PS10": {"cap": 12, "cat": "Hospital de Simulación"},
    "PS11": {"cap": 12, "cat": "Hospital de Simulación"},
    "PS12": {"cap": 12, "cat": "Hospital de Simulación"},
    "PS13": {"cap": 12, "cat": "Hospital de Simulación"},
    "PS15": {"cap": 12, "cat": "Hospital de Simulación"},
    "PS16": {"cap": 12, "cat": "Hospital de Simulación"},
    "PS18": {"cap": 10, "cat": "Hospital de Simulación"},
    "VPS00": {"cap": 13, "cat": "Sala Virtual"},
    "A201": {"cap": 25, "cat": "Sala"},
    "A307": {"cap": 59, "cat": "Sala"},
    "B103": {"cap": 56, "cat": "Sala"},
    "P207": {"cap": 60, "cat": "Sala"},
    "A305": {"cap": 54, "cat": "Sala"},
    "I201": {"cap": 30, "cat": "Laboratorio"},
    "A308": {"cap": 30, "cat": "Laboratorio"},
    "B104": {"cap": 46, "cat": "Sala"},
    "P302": {"cap": 84, "cat": "Sala"},
    "VA100": {"cap": 1000, "cat": "Sala Virtual"},
    "P103": {"cap": 106, "cat": "Sala"},
    "F104": {"cap": 30, "cat": "Laboratorio"},
    "G106": {"cap": 18, "cat": "Taller"},
    "P308": {"cap": 57, "cat": "Sala"},
    "A205": {"cap": 87, "cat": "Sala"},
    "P205": {"cap": 63, "cat": "Sala"},
    "A206": {"cap": 52, "cat": "Sala"},
    "A303": {"cap": 51, "cat": "Sala"},
    "I102": {"cap": 50, "cat": "Sala"},
    "A101": {"cap": 75, "cat": "Taller"},
    "A207": {"cap": 83, "cat": "Sala"},
    "A306": {"cap": 31, "cat": "Lab. Comp"},
    "P305": {"cap": 46, "cat": "Sala"},
    "A108": {"cap": 58, "cat": "Sala"},
    "G104": {"cap": 38, "cat": "Taller"},
    "P202A": {"cap": 40, "cat": "Sala"},
    "P301": {"cap": 82, "cat": "Sala"},
    "D105": {"cap": 27, "cat": "Laboratorio"},
    "A203": {"cap": 42, "cat": "Sala"},
    "A209": {"cap": 88, "cat": "Sala"},
    "B203": {"cap": 30, "cat": "Laboratorio"},
    "P204": {"cap": 40, "cat": "Sala"},
    "A204": {"cap": 83, "cat": "Sala"},
    "G103": {"cap": 60, "cat": "Taller"},
    "A103": {"cap": 64, "cat": "Sala"},
    "A107": {"cap": 67, "cat": "Sala"},
    "A208": {"cap": 80, "cat": "Sala"},
    "P101": {"cap": 55, "cat": "Sala"},
    "A105": {"cap": 54, "cat": "Sala"},
    "A109": {"cap": 84, "cat": "Sala"},
    "B201": {"cap": 30, "cat": "Laboratorio"},
    "B205": {"cap": 30, "cat": "Laboratorio"},
    "A309": {"cap": 35, "cat": "Lab. Comp"},
    "P104": {"cap": 96, "cat": "Sala"},
    "A202": {"cap": 48, "cat": "Sala"},
    "G107": {"cap": 8, "cat": "Taller"},
    "G101": {"cap": 69, "cat": "Taller"},
    "G102": {"cap": 71, "cat": "Taller"},
    "A311": {"cap": 67, "cat": "Sala"},
    "B202": {"cap": 30, "cat": "Laboratorio"},
    "P102": {"cap": 43, "cat": "Sala"},
    "A106": {"cap": 82, "cat": "Sala"},
    "A301": {"cap": 34, "cat": "Lab. Comp"},
    "B204": {"cap": 30, "cat": "Laboratorio"},
}

EXTRA_SCHEDULE = []
DELETED_ENTRIES = []


def normalize_columns(df):
    df.columns = df.columns.str.strip().str.lower()
    column_mapping = {
        "nombre": "nombre_asignatura",
        "materia": "codigo_materia",
        "sala": "ubicacion",
        "carrera_reserva": "grupo",
        "hr_inicio": "inicio",
        "hr_fin": "fin",
        "nrc": "nrc",
        "seccion": "seccion",
        "sección": "seccion",
        "n_curso": "n_curso",
        "componente": "componente",
        "fecha_ini": "fecha_ini",
        "fecha_term": "fecha_term",
        "nombre_": "prof_nombre",
        "apellido": "prof_apellido",
    }
    df.rename(columns=column_mapping, inplace=True)
    return df


def get_affected_modules(start_str, end_str):
    try:
        s_raw = str(start_str).strip().replace(".0", "")
        e_raw = str(end_str).strip().replace(".0", "")
        s_clean = s_raw.replace(":", "")[:4]
        e_clean = e_raw.replace(":", "")[:4]
        start_val = int(s_clean)
        end_val = int(e_clean)

        if start_val == 800 and (1035 <= end_val <= 1045):
            return [1, 2]
        if start_val == 930 and (1205 <= end_val <= 1215):
            return [2, 3]
        if start_val == 1100 and (1335 <= end_val <= 1345):
            return [3, 4]
        if start_val == 1400 and (1635 <= end_val <= 1645):
            return [5, 6]
        if start_val == 1700 and (1935 <= end_val <= 1945):
            return [7, 8]

        affected = []
        if 800 <= start_val <= 925:
            affected.append(1)
        elif 930 <= start_val <= 1055:
            affected.append(2)
        elif 1100 <= start_val <= 1225:
            affected.append(3)
        elif 1230 <= start_val <= 1355:
            affected.append(4)
        elif 1400 <= start_val <= 1525:
            affected.append(5)
        elif 1530 <= start_val <= 1655:
            affected.append(6)
        elif 1700 <= start_val <= 1825:
            affected.append(7)
        elif 1830 <= start_val <= 2000:
            affected.append(8)
        return affected
    except Exception:
        return []


def calculate_occupancy_color(blocks_used):
    if blocks_used >= 30:
        return "ocup-high", "Saturada", "bg-red-500"
    elif blocks_used >= 15:
        return "ocup-med", "Normal", "bg-yellow-500"
    else:
        return "ocup-low", "Libre", "bg-green-500"


def parse_schedule_row(row):
    entries = []
    days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]
    inicio = str(row.get("inicio", "")).strip().replace(".0", "")
    fin = str(row.get("fin", "")).strip().replace(".0", "")

    target_modules = get_affected_modules(inicio, fin)
    if not target_modules:
        return []

    nombre_asignatura = str(row.get("nombre_asignatura", "Sin Nombre")).strip()
    ubicacion = str(row.get("ubicacion", "Sin Sala")).strip()
    grupo = str(row.get("grupo", "General")).strip()
    nrc = str(row.get("nrc", "")).strip().replace(".0", "")
    if nrc.lower() == "nan" or nrc == "":
        nrc = "?"
    seccion = str(row.get("seccion", "")).strip()
    if seccion.lower() == "nan" or seccion == "":
        seccion = "?"
    codigo_materia = str(row.get("codigo_materia", "")).strip()
    n_curso = str(row.get("n_curso", "")).strip()
    componente = str(row.get("componente", "")).strip()
    fecha_ini = str(row.get("fecha_ini", "")).split(" ")[0]
    fecha_term = str(row.get("fecha_term", "")).split(" ")[0]
    prof_nombre = str(row.get("prof_nombre", "")).strip()
    prof_apellido = str(row.get("prof_apellido", "")).strip()
    prof_completo = f"{prof_nombre} {prof_apellido}".strip()
    if prof_completo == "":
        prof_completo = "Por Asignar"

    for day in days:
        if day in row.index:
            val = str(row[day]).strip().lower()
            if val not in ("nan", "", "none"):
                for mod_num in target_modules:
                    entries.append(
                        {
                            "materia": nombre_asignatura,
                            "codigo_materia": codigo_materia,
                            "ubicacion": ubicacion,
                            "grupo": grupo,
                            "nrc": nrc,
                            "seccion": seccion,
                            "n_curso": n_curso,
                            "componente": componente,
                            "fecha_ini": fecha_ini,
                            "fecha_term": fecha_term,
                            "profesor": prof_completo,
                            "tiempo": f"{inicio} - {fin}",
                            "modulo": mod_num,
                            "dia_norm": day,
                        }
                    )
    return entries


def process_schedule(file_path):
    try:
        df = pd.read_excel(file_path)
        df = normalize_columns(df)
        if "nombre_asignatura" not in df.columns or "ubicacion" not in df.columns:
            return None, "Faltan columnas NOMBRE o SALA."

        df = df.dropna(subset=["ubicacion"])
        df = df.drop_duplicates()

        expanded_schedule = []
        room_usage_counter = {room: 0 for room in ROOM_DATABASE.keys()}

        for _, row in df.iterrows():
            class_instances = parse_schedule_row(row)
            sala_excel = str(row["ubicacion"]).strip()

            if sala_excel not in ROOM_DATABASE:
                ROOM_DATABASE[sala_excel] = {"cap": 0, "cat": "Desconocida"}
                room_usage_counter[sala_excel] = 0

            for instance in class_instances:
                is_duplicate = False
                for existing in expanded_schedule:
                    if (
                        existing["ubicacion"] == sala_excel
                        and existing["dia_norm"] == instance["dia_norm"]
                        and existing["modulo"] == instance["modulo"]
                    ):
                        is_duplicate = True
                        break
                if not is_duplicate:
                    instance["ubicacion"] = sala_excel
                    expanded_schedule.append(instance)
                    room_usage_counter[sala_excel] += 1

        TOTAL_WEEKLY_BLOCKS = 48
        room_stats = []

        for sala, count in room_usage_counter.items():
            percentage = (count / TOTAL_WEEKLY_BLOCKS) * 100
            css_class, status_text, dot_color = calculate_occupancy_color(count)
            details = ROOM_DATABASE.get(sala, {"cap": 0, "cat": "Desconocida"})

            room_stats.append(
                {
                    "sala": sala,
                    "ocupados": count,
                    "capacidad_max": details["cap"],
                    "categoria": details["cat"],
                    "porcentaje": round(percentage, 1),
                    "status_class": css_class,
                    "status_text": status_text,
                    "dot_color": dot_color,
                }
            )

        room_stats.sort(key=lambda x: x["sala"])
        return {
            "stats": room_stats,
            "schedule": expanded_schedule,
            "total_rooms": len(room_stats),
            "total_courses": len(expanded_schedule),
        }, None
    except Exception as e:
        return None, str(e)


@rooms_bp.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file"}), 400
    try:
        # FIX: Usar current_app para obtener la config de la app principal
        filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], file.filename)
        file.save(filepath)
        data, error = process_schedule(filepath)
        if error:
            return jsonify({"error": error}), 500

        # Merge extra schedule
        if data and "schedule" in data:
            # Filter out deleted entries from file data
            data["schedule"] = [
                s
                for s in data["schedule"]
                if not any(
                    d["nrc"] == s["nrc"]
                    and d["seccion"] == s["seccion"]
                    and d["dia_norm"] == s["dia_norm"]
                    and d["modulo"] == s["modulo"]
                    and d["ubicacion"] == s["ubicacion"]
                    for d in DELETED_ENTRIES
                )
            ]
            # Add extra schedule (filtering deleted ones too just in case)
            active_extras = [
                s
                for s in EXTRA_SCHEDULE
                if not any(
                    d["nrc"] == s["nrc"]
                    and d["seccion"] == s["seccion"]
                    and d["dia_norm"] == s["dia_norm"]
                    and d["modulo"] == s["modulo"]
                    and d["ubicacion"] == s["ubicacion"]
                    for d in DELETED_ENTRIES
                )
            ]
            data["schedule"].extend(active_extras)

        return jsonify({"success": True, "data": data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@rooms_bp.route("/add_room", methods=["POST"])
def add_room():
    data = request.json
    new_room = data.get("room_name")
    capacity = data.get("capacity", 30)
    category = data.get("category", "Sala")
    if new_room:
        clean_name = new_room.strip().upper()
        ROOM_DATABASE[clean_name] = {"cap": int(capacity), "cat": category}
        return jsonify({"success": True})
    return jsonify({"error": "Nombre inválido"}), 400


@rooms_bp.route("/delete_room", methods=["POST"])
def delete_room():
    data = request.json
    room_to_delete = data.get("room_name")
    if room_to_delete and room_to_delete in ROOM_DATABASE:
        del ROOM_DATABASE[room_to_delete]
        return jsonify({"success": True})
    return jsonify({"error": "Sala no encontrada"}), 404


@rooms_bp.route("/assign_subject", methods=["POST"])
def assign_subject():
    data = request.json
    # Validate required fields
    required = ["nrc", "seccion", "dia", "modulo", "sala"]
    if not all(k in data for k in required):
        return jsonify({"error": "Faltan datos requeridos"}), 400

    # Create schedule entry
    new_entry = {
        "materia": data.get("materia", "Asignatura Manual"),
        "codigo_materia": data.get("codigo", ""),
        "ubicacion": data["sala"],
        "grupo": "",
        "nrc": data["nrc"],
        "seccion": data["seccion"],
        "n_curso": "",
        "componente": "",
        "fecha_ini": "",
        "fecha_term": "",
        "profesor": "Por Asignar",
        "tiempo": "",
        "modulo": int(data["modulo"]),
        "dia_norm": data["dia"],
        "type": "manual",
    }

    EXTRA_SCHEDULE.append(new_entry)
    return jsonify({"success": True, "entry": new_entry})


@rooms_bp.route("/delete_assignment", methods=["POST"])
def delete_assignment():
    data = request.json
    required = ["nrc", "seccion", "dia_norm", "modulo", "ubicacion"]
    if not all(k in data for k in required):
        return jsonify({"error": "Faltan datos para identificar el bloque"}), 400

    # Remove from EXTRA_SCHEDULE if present
    global EXTRA_SCHEDULE
    EXTRA_SCHEDULE = [
        s
        for s in EXTRA_SCHEDULE
        if not (
            s["nrc"] == data["nrc"]
            and s["seccion"] == data["seccion"]
            and s["dia_norm"] == data["dia_norm"]
            and s["modulo"] == data["modulo"]
            and s["ubicacion"] == data["ubicacion"]
        )
    ]

    # Add to DELETED_ENTRIES to prevent it from reappearing from file
    DELETED_ENTRIES.append(
        {
            "nrc": data["nrc"],
            "seccion": data["seccion"],
            "dia_norm": data["dia_norm"],
            "modulo": data["modulo"],
            "ubicacion": data["ubicacion"],
        }
    )

    return jsonify({"success": True})
