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


def get_affected_modules(start_str, end_str):
    """
    Devuelve una lista de los módulos afectados.
    """
    try:
        # Limpieza agresiva: str(), .strip(), quitar .0, quitar :
        s_raw = str(start_str).strip().replace(".0", "")
        e_raw = str(end_str).strip().replace(".0", "")
        
        # Convertir "08:00" -> "0800" y luego a entero 800
        s_clean = s_raw.replace(":", "")[:4]
        e_clean = e_raw.replace(":", "")[:4]
        
        start_val = int(s_clean)
        end_val = int(e_clean)

        # --- CASOS DE BLOQUES DOBLES ---
        # Agregué un margen de error pequeño por si el Excel dice 10:39 o 10:41
        # 08:00 (800) a 10:40 (1040) -> M1 y M2
        if start_val == 800 and (1035 <= end_val <= 1045): 
            print(f">> Bloque Doble Detectado: {start_val} - {end_val}")
            return [1, 2]
        
        # 09:30 (930) a 12:10 (1210) -> M2 y M3
        if start_val == 930 and (1205 <= end_val <= 1215): 
            print(f">> Bloque Doble Detectado: {start_val} - {end_val}")
            return [2, 3]
        
        # 11:00 (1100) a 13:40 (1340) -> M3 y M4
        if start_val == 1100 and (1335 <= end_val <= 1345): 
            print(f">> Bloque Doble Detectado: {start_val} - {end_val}")
            return [3, 4]
        
        # 14:00 (1400) a 16:40 (1640) -> M5 y M6
        if start_val == 1400 and (1635 <= end_val <= 1645): 
            print(f">> Bloque Doble Detectado: {start_val} - {end_val}")
            return [5, 6]
        
        # 17:00 (1700) a 19:40 (1940) -> M7 y M8
        if start_val == 1700 and (1935 <= end_val <= 1945): 
            print(f">> Bloque Doble Detectado: {start_val} - {end_val}")
            return [7, 8]

        # --- CASOS DE BLOQUES SIMPLES (Fallback) ---
        affected = []
        if 800 <= start_val <= 925: affected.append(1)
        elif 930 <= start_val <= 1055: affected.append(2)
        elif 1100 <= start_val <= 1225: affected.append(3)
        elif 1230 <= start_val <= 1355: affected.append(4)
        elif 1400 <= start_val <= 1525: affected.append(5)
        elif 1530 <= start_val <= 1655: affected.append(6)
        elif 1700 <= start_val <= 1825: affected.append(7)
        elif 1830 <= start_val <= 2000: affected.append(8)

        return affected

    except Exception as e:
        # print(f"Error parseando hora: {start_str} - {end_str} | {e}")
        return []


def calculate_occupancy_color(blocks_used):
    """Definir estado basado en cantidad de bloques, no porcentaje"""
    # Regla: Desde 30 bloques (inclusive) -> Saturada
    if blocks_used >= 30:
        return "ocup-high", "Saturada", "bg-red-500"
    # Regla: Desde 15 bloques (inclusive) -> Normal
    elif blocks_used >= 15:
        return "ocup-med", "Normal", "bg-yellow-500"
    # Regla: 14 hacia abajo -> Libre
    else:
        return "ocup-low", "Libre", "bg-green-500"


def parse_schedule_row(row):
    entries = []
    days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]

    # Limpieza robusta de strings
    inicio = str(row.get("inicio", "")).strip().replace(".0", "")
    fin = str(row.get("fin", "")).strip().replace(".0", "")
    
    target_modules = get_affected_modules(inicio, fin)

    if not target_modules: 
        return [] 

    materia = str(row.get("materia", "Sin Nombre")).strip()
    ubicacion = str(row.get("ubicacion", "Sin Sala")).strip()
    grupo = str(row.get("grupo", "General")).strip()
    
    nrc = str(row.get("nrc", "")).strip().replace(".0", "")
    if nrc.lower() == "nan" or nrc == "": nrc = "?"
    
    seccion = str(row.get("seccion", "")).strip()
    if seccion.lower() == "nan" or seccion == "": seccion = "?"

    for day in days:
        if day in row.index:
            val = str(row[day]).strip().lower()
            if val not in ("nan", "", "none"):
                for mod_num in target_modules:
                    entries.append({
                        "materia": materia,
                        "ubicacion": ubicacion,
                        "grupo": grupo,
                        "nrc": nrc,
                        "seccion": seccion,
                        "tiempo": f"{inicio} - {fin}",
                        "modulo": mod_num,
                        "dia_norm": day
                    })
    return entries

def process_schedule(file_path):
    try:
        # CAMBIO IMPORTANTE: Quitamos engine="openpyxl" para que detecte automático
        # esto evita errores con archivos .xls antiguos
        df = pd.read_excel(file_path) 
        df = normalize_columns(df)

        if "materia" not in df.columns or "ubicacion" not in df.columns:
            return None, "Faltan columnas NOMBRE o SALA."

        df = df.dropna(subset=["ubicacion"])

        # Eliminamos duplicados exactos de fila en el Excel original
        df = df.drop_duplicates()

        expanded_schedule = []
        room_usage_counter = {room: 0 for room in dynamic_rooms}

        for _, row in df.iterrows():
            class_instances = parse_schedule_row(row)
            sala_excel = str(row["ubicacion"]).strip()

            if sala_excel not in room_usage_counter:
                room_usage_counter[sala_excel] = 0
                dynamic_rooms.add(sala_excel)

            for instance in class_instances:
                # Chequeo de colisiones:
                # Si ya existe una clase en esa Sala + Dia + Modulo, ignoramos la nueva.
                # Esto maneja la duplicidad que mencionaste.
                is_duplicate = False
                for existing in expanded_schedule:
                    if (existing["ubicacion"] == sala_excel
                        and existing["dia_norm"] == instance["dia_norm"]
                        and existing["modulo"] == instance["modulo"]):
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    instance["ubicacion"] = sala_excel
                    expanded_schedule.append(instance)
                    room_usage_counter[sala_excel] += 1

        # Generar Estadísticas
        TOTAL_WEEKLY_BLOCKS = 48 
        room_stats = []

        for sala, count in room_usage_counter.items():
            percentage = (count / TOTAL_WEEKLY_BLOCKS) * 100
            
            # --- CORRECCIÓN AQUÍ ---
            # Antes pasabas 'percentage', ahora pasamos 'count' (número de bloques)
            css_class, status_text, dot_color = calculate_occupancy_color(count)

            room_stats.append({
                "sala": sala,
                "ocupados": count,
                "capacidad_max": 30, 
                "porcentaje": round(percentage, 1),
                "status_class": css_class,
                "status_text": status_text,
                "dot_color": dot_color,
            })

        room_stats.sort(key=lambda x: x["sala"])

        return {
            "stats": room_stats,
            "schedule": expanded_schedule,
            "total_rooms": len(room_stats),
            "total_courses": len(expanded_schedule),
        }, None

    except Exception as e:
        print(f"Error Fatal: {e}")
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
    data = request.json
    new_room = data.get("room_name")
    if new_room:
        dynamic_rooms.add(new_room.strip().upper())
        return jsonify({"success": True})
    return jsonify({"error": "Nombre inválido"}), 400


if __name__ == "__main__":
    app.run(debug=True, port=5000)