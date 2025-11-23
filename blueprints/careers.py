from flask import Blueprint, request, jsonify, current_app
import pandas as pd
import os

careers_bp = Blueprint("careers", __name__)

CAREER_DATA_STORE = {}


def process_career_file(file_path, filename):
    try:
        career_name = "Desconocida"
        if "-" in filename:
            career_name = (
                filename.split("-")[-1].replace(".csv", "").replace(".xlsx", "").strip()
            )

        if file_path.endswith(".csv"):
            df = pd.read_csv(file_path, encoding="latin-1", sep=None, engine="python")
        else:
            df = pd.read_excel(file_path)

        df.columns = df.columns.str.strip().str.lower()
        schedule_entries = []

        days_map = {
            "lunes": "lunes",
            "martes": "martes",
            "miércoles": "miercoles",
            "miercoles": "miercoles",
            "jueves": "jueves",
            "viernes": "viernes",
            "sábado": "sabado",
            "sabado": "sabado",
        }
        detected_days = [col for col in df.columns if col in days_map]

        for index, row in df.iterrows():
            semestre = str(row.get("semestre", "1")).strip()
            malla = str(row.get("malla", "2024")).strip()

            for day_col in detected_days:
                cell_value = str(row[day_col]).strip()
                if cell_value and cell_value.lower() not in ["nan", "none", ""]:
                    entry = {
                        "raw_text": cell_value,
                        "dia": days_map[day_col],
                        "semestre": semestre,
                        "malla": malla,
                        "asignatura": (
                            cell_value.split("/")[0]
                            if "/" in cell_value
                            else cell_value
                        ),
                        "tipo": "TEO",
                        "espejo": False,
                    }
                    schedule_entries.append(entry)

        if career_name not in CAREER_DATA_STORE:
            CAREER_DATA_STORE[career_name] = []
        CAREER_DATA_STORE[career_name].extend(schedule_entries)

        return {
            "career": career_name,
            "entries_count": len(schedule_entries),
            "semesters_found": list(set(x["semestre"] for x in schedule_entries)),
        }, None

    except Exception as e:
        print(f"Error procesando carrera: {e}")
        return None, str(e)


@careers_bp.route("/upload_career", methods=["POST"])
def upload_career():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file"}), 400
    try:
        # FIX: Usar current_app para acceder a la configuración global
        filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], file.filename)
        file.save(filepath)
        data, error = process_career_file(filepath, file.filename)
        if error:
            return jsonify({"error": error}), 500
        return jsonify({"success": True, "data": data, "full_store": CAREER_DATA_STORE})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
