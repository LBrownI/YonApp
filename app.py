import os
from flask import Flask, render_template, request, jsonify
import pandas as pd
import math

app = Flask(__name__)

# Configuración de carpeta de subida
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# --- LÓGICA DE NEGOCIO ---


def normalize_columns(df):
    """
    Estandariza los nombres de las columnas basándonos en TU Excel real.
    Convierte todo a minúsculas para evitar errores por mayúsculas/minúsculas.
    """
    df.columns = df.columns.str.strip().str.lower()

    # Mapeo: Nombre en tu Excel -> Nombre interno en Python
    column_mapping = {
        "nombre": "materia",  # Columna 'NOMBRE' es la materia
        "sala": "ubicacion",  # Columna 'SALA' es la ubicación
        "carrera_reserva": "grupo",  # Usamos esta para saber el grupo/carrera
        "hr_inicio": "inicio",  # Hora de inicio
        "hr_fin": "fin",  # Hora de término
        # Los días (lunes, martes...) ya se llaman igual al pasar a minúsculas
    }

    df.rename(columns=column_mapping, inplace=True)
    return df


def calculate_occupancy_color(occupancy_percentage):
    """Define el color del semáforo según el porcentaje"""
    if occupancy_percentage >= 70:
        return "ocup-high", "Saturada", "bg-red-500"  # Rojo
    elif occupancy_percentage >= 20:
        return "ocup-med", "Normal", "bg-yellow-500"  # Amarillo
    else:
        return "ocup-low", "Libre", "bg-green-500"  # Verde


def parse_schedule_row(row):
    """
    Analiza una fila del Excel.
    Tu formato tiene columnas separadas para cada día (LUNES, MARTES, etc).
    Si la columna tiene dato, creamos un bloque de horario.
    """
    entries = []
    days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]

    # Obtener horas y limpiar formato
    inicio = str(row.get("inicio", ""))
    fin = str(row.get("fin", ""))

    # Quitar decimales si vienen como float (ej: "0830.0" -> "0830")
    if inicio.endswith(".0"):
        inicio = inicio[:-2]
    if fin.endswith(".0"):
        fin = fin[:-2]

    time_str = f"{inicio} - {fin}"

    # ⚠️ Forzamos a string para evitar que sean Series
    materia = str(row.get("materia", "Sin Nombre"))
    ubicacion = str(row.get("ubicacion", "Sin Sala"))
    grupo = str(row.get("grupo", "General"))

    for day in days:
        # Mejor ser explícitos: mirar el índice de la Series
        if day in row.index:
            val = str(row[day]).strip().lower()

            # Si la celda tiene algo (no está vacía ni es 'nan'), hay clase
            if val not in ("nan", "", "none"):
                entries.append(
                    {
                        "materia": materia,
                        "ubicacion": ubicacion,
                        "grupo": grupo,
                        "tiempo": time_str,
                        "dia_semana": day.capitalize(),  # Ej: "Lunes"
                        "full_time_string": f"{day.capitalize()} {time_str}",
                    }
                )

    return entries


def process_schedule(file_path):
    try:
        # 1. Leer Excel (engine='openpyxl' es mejor para xlsx modernos)
        df = pd.read_excel(file_path, engine="openpyxl")
        df = normalize_columns(df)

        # Validar columnas críticas para que no falle
        if "materia" not in df.columns or "ubicacion" not in df.columns:
            return (
                None,
                f"Error: El Excel no tiene las columnas 'NOMBRE' o 'SALA'. Columnas detectadas: {list(df.columns)}",
            )

        # Eliminar filas que no tengan sala asignada
        df = df.dropna(subset=["ubicacion"])

        # 2. Expandir Horario (Crear lista plana de clases)
        expanded_schedule = []
        room_usage_counter = {}

        for _, row in df.iterrows():
            # Obtener las clases de esta fila (revisando columnas de días)
            class_instances = parse_schedule_row(row)

            # Asegurar que el nombre de la sala es texto limpio
            sala = str(row["ubicacion"]).strip()
            if sala == "" or sala.lower() == "nan":
                continue

            for instance in class_instances:
                instance["ubicacion"] = sala  # Asegurar nombre limpio
                expanded_schedule.append(instance)

                # Contar bloque ocupado para esta sala
                if sala not in room_usage_counter:
                    room_usage_counter[sala] = 0
                room_usage_counter[sala] += 1

        # 3. Generar Estadísticas (Semáforo)
        # Asumimos 40 bloques a la semana como 100% de ocupación
        TOTAL_WEEKLY_BLOCKS = 40
        room_stats = []

        for sala, count in room_usage_counter.items():
            percentage = (count / TOTAL_WEEKLY_BLOCKS) * 100
            percentage = min(percentage, 100)

            css_class, status_text, dot_color = calculate_occupancy_color(percentage)

            room_stats.append(
                {
                    "sala": sala,
                    "ocupados": count,
                    "total_bloques": TOTAL_WEEKLY_BLOCKS,
                    "porcentaje": round(percentage, 1),
                    "status_class": css_class,
                    "status_text": status_text,
                    "dot_color": dot_color,
                }
            )

        # Ordenar alfabéticamente las salas
        room_stats.sort(key=lambda x: x["sala"])

        return {
            "stats": room_stats,
            "schedule": expanded_schedule,
            "total_rooms": len(room_stats),
            "total_courses": len(df),
        }, None

    except Exception as e:
        print(f"Error procesando: {e}")
        return None, f"Error interno procesando el archivo: {str(e)}"


# --- RUTAS FLASK ---


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No se recibió ningún archivo"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No seleccionaste ningún archivo"}), 400

    if file:
        try:
            filepath = os.path.join(app.config["UPLOAD_FOLDER"], file.filename)
            file.save(filepath)

            # Procesar lógica
            data, error = process_schedule(filepath)

            if error:
                return jsonify({"error": error}), 500

            return jsonify({"success": True, "data": data})
        except Exception as e:
            return jsonify({"error": f"Error grave: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
