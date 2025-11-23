import os
from flask import Flask, render_template
from blueprints.rooms import rooms_bp
from blueprints.careers import careers_bp

app = Flask(__name__)

# Configuración Global
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Registrar Módulos
app.register_blueprint(rooms_bp)
app.register_blueprint(careers_bp)


@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
