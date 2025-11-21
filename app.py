import os
from flask import Flask, render_template, request, jsonify
import pandas as pd
import math

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# --- CONFIGURACIÓN: SALAS FIJAS ---
DEFAULT_ROOMS = [
    "A101", "A102", "A103", "A105", "A106", "A107", "A108", "A109", "A201", "A202", "A203", "A204", "A205", "A206", "A207",
    "A208", "A209", "A210", "A301", "A302", "A302B", "A302C", "A303", "A304", "A305", "A306", "A307", "A308", "A309", "A311",
    "A312", "A313", "A314", "B102", "B103", "B104", "B201", "B202", "B203", "B204", "B205", "D104", "D105", "D106", "D107",
    "D108", "D109", "D110", "D201", "F101", "F103", "F104", "F201", "G101", "G102", "G103", "G104", "G105", "G106", "G107", "I101A",
    "I101B", "I102", "I104", "I105", "I105-B", "I106", "I108", "I201", "I202", "I204", "I206", "I210", "J101", "J102", "J201", "P101",
    "P102", "P103", "P104", "P202A", "P203A", "P203B", "P204", "P205", "P206A", "P206B", "P207", "P301", "P302", "P305", "P306A", "P306B",
    "P307", "P308", "P310", "PS01", "PS02", "PS03", "PS04", "PS05", "PS06", "PS07", "PS08", "PS09", "PS10", "PS11", "PS12", "PS13", "PS15",
    "PS16", "PS18", "VA100", "VPS00",
]

# Variable global simple para almacenar nuevas salas añadidas en tiempo de ejecución
dynamic_rooms = set(DEFAULT_ROOMS)


def normalize_columns(df):
    df.columns = df.columns.str.strip().str.lower()
    # Agregamos 'nrc' y 'seccion' al mapa
    column_mapping = {
        "nombre": "materia",
        "sala": "ubicacion",
        "carrera_reserva": "grupo",
        "hr_inicio": "inicio",
        "hr_fin": "fin",
        "nrc": "nrc",           # <--- NUEVO
        "seccion": "seccion",   # <--- NUEVO
        "sección": "seccion"    # <--- Por si viene con tilde
    }
    df.rename(columns=column_mapping, inplace=True)
    return df


def get_module_number(start_time_str):
    """Asigna un número de módulo basado en la hora de inicio"""
    try:
        # Convertir "08:00" o "08:00:00" a entero 800
        clean_time = str(start_time_str).replace(":", "").split(".")[0][:4]  # "0830"
        time_val = int(clean_time)

        if 800 <= time_val <= 925:
            return 1
        if 930 <= time_val <= 1055:
            return 2
        if 1100 <= time_val <= 1225:
            return 3
        if 1230 <= time_val <= 1355:
            return 4
        if 1400 <= time_val <= 1525:
            return 5
        if 1530 <= time_val <= 1655:
            return 6
        if 1700 <= time_val <= 1825:
            return 7
        if 1830 <= time_val <= 2000:
            return 8
    except:
        pass
    return 0  # No válido


def calculate_occupancy_color(occupancy_percentage):
    if occupancy_percentage >= 63:
        return "ocup-high", "Saturada", "bg-red-500"
    elif occupancy_percentage >= 40:
        return "ocup-med", "Normal", "bg-yellow-500"
    else:
        return "ocup-low", "Libre", "bg-green-500"


def parse_schedule_row(row):
    entries = []
    days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]

    inicio = str(row.get("inicio", "")).replace(".0", "")
    fin = str(row.get("fin", "")).replace(".0", "")
    module_num = get_module_number(inicio)

    if module_num == 0:
        return []

    # Datos existentes
    materia = str(row.get("materia", "Sin Nombre"))
    ubicacion = str(row.get("ubicacion", "Sin Sala"))
    grupo = str(row.get("grupo", "General"))

    # --- NUEVO: Extracción de NRC y Sección ---
    # El NRC suele venir como número (ej: 1828.0), así que quitamos el .0
    nrc = str(row.get("nrc", "")).replace(".0", "")
    if nrc == "nan":
        nrc = "?"

    seccion = str(row.get("seccion", ""))
    if seccion == "nan":
        seccion = "?"
    # ------------------------------------------

    for day in days:
        if day in row.index:
            val = str(row[day]).strip().lower()
            if val not in ("nan", "", "none"):
                entries.append({
                    "materia": materia,
                    "ubicacion": ubicacion,
                    "grupo": grupo,
                    "nrc": nrc,           # <--- Enviamos NRC
                    "seccion": seccion,   # <--- Enviamos Sección
                    "tiempo": f"{inicio} - {fin}",
                    "modulo": module_num,
                    "dia_norm": day
                })
    return entries


def process_schedule(file_path):
    try:
        df = pd.read_excel(file_path, engine="openpyxl")
        df = normalize_columns(df)

        if "materia" not in df.columns or "ubicacion" not in df.columns:
            return None, "Faltan columnas NOMBRE o SALA."

        df = df.dropna(subset=["ubicacion"])

        # --- REQUERIMIENTO 1: ELIMINAR DUPLICADOS ---
        # Eliminamos filas que tengan exactamente la misma ubicación, materia y hora
        # Nota: Como el excel es 'ancho' (días en columnas), primero debemos 'derretir' o procesar
        # pero una forma rápida es eliminar duplicados exactos de fila primero.
        df = df.drop_duplicates()

        expanded_schedule = []
        room_usage_counter = {
            room: 0 for room in dynamic_rooms
        }  # Inicializar todas las salas en 0

        for _, row in df.iterrows():
            class_instances = parse_schedule_row(row)
            sala_excel = str(row["ubicacion"]).strip()

            # Agregar sala si no existe en la lista fija (opcional, o forzar error)
            if sala_excel not in room_usage_counter:
                # Si queremos ser estrictos con las salas fijas, ignoramos o agregamos:
                # Por ahora, la agregamos para no perder datos del excel
                room_usage_counter[sala_excel] = 0
                dynamic_rooms.add(sala_excel)

            for instance in class_instances:
                # Verificación extra de duplicidad en la lista expandida
                # (mismo modulo, mismo dia, misma sala)
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

        # Generar Estadísticas
        TOTAL_WEEKLY_BLOCKS = 48  # 8 modulos * 6 dias
        room_stats = []

        for sala, count in room_usage_counter.items():
            percentage = (count / TOTAL_WEEKLY_BLOCKS) * 100
            css_class, status_text, dot_color = calculate_occupancy_color(percentage)

            room_stats.append(
                {
                    "sala": sala,
                    "ocupados": count,
                    "capacidad_max": 30,  # Valor por defecto (Requerimiento 2)
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
        print(f"Error: {e}")
        return None, str(e)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file"}), 400

    try:
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], file.filename)
        file.save(filepath)
        data, error = process_schedule(filepath)
        if error:
            return jsonify({"error": error}), 500
        return jsonify({"success": True, "data": data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/add_room", methods=["POST"])
def add_room():
    """Endpoint para añadir salas dinámicamente"""
    data = request.json
    new_room = data.get("room_name")
    if new_room:
        dynamic_rooms.add(new_room.strip().upper())
        return jsonify({"success": True})
    return jsonify({"error": "Nombre inválido"}), 400


if __name__ == "__main__":
    app.run(debug=True, port=5000)
