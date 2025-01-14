from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import os
import json
import requests

app = Flask(__name__)
username = 'sbx202x'

# Construct absolute paths
app_dir = os.path.dirname(os.path.abspath(__file__))
database_path = os.path.join(app_dir, "instance", "sbx202x_Aporia_Sched.db")

#Only for IDE, remove for PYA
os.makedirs(os.path.join(app_dir, "instance"), exist_ok=True)

#### Construct absolute paths (swap this for the other when moved to pyanywhere)
#app_dir = os.path.dirname(os.path.abspath(__file__))
#database_path = os.path.join(app_dir, "sbx202x_Aporia_Sched.db")
#json_file_path = os.path.join(app_dir, 'static', 'js', 'electronjsoncombined_edit.json')

##change back with pya (delete one below this)
#app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:////{database_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{database_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# API configuration
API_BASE_URL = "https://api.electronhub.top/v1/"
API_KEY = "ek-BHhUiYb8F5J1TDxnEvnOddeFBWrc6ArAKBqW1dkwelgcRom3VS"

# Database Models
class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    main_goal = db.Column(db.Text)
    subgoals = db.relationship('Subgoal', backref='project', lazy=True, cascade='all, delete-orphan')

class Subgoal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.Text, nullable=False)
    label = db.Column(db.String(255))
    time_spent = db.Column(db.Integer, default=0)
    notes = db.Column(db.Text)
    completed = db.Column(db.Boolean, default=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    order = db.Column(db.Integer)

# Routes
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/projects", methods=["GET"])
def get_projects():
    projects = Project.query.all()
    return jsonify([{
        "id": p.id,
        "name": p.name,
        "main_goal": p.main_goal,
        "subgoals": [{
            "id": sg.id,
            "description": sg.description,
            "label": sg.label,
            "time_spent": sg.time_spent,
            "notes": sg.notes,
            "completed": sg.completed,
            "order": sg.order
        } for sg in sorted(p.subgoals, key=lambda x: x.order or 0)]
    } for p in projects])

@app.route("/api/projects", methods=["POST"])
def save_project():
    try:
        data = request.get_json()
        
        # Check for existing project with same name
        existing_project = Project.query.filter_by(name=data['name']).first()
        if existing_project:
            # Update existing project instead of creating new one
            existing_project.main_goal = data['main_goal']
            # Clear existing subgoals
            for sg in existing_project.subgoals:
                db.session.delete(sg)
            
            # Add new subgoals
            for index, sg_data in enumerate(data.get('subgoals', [])):
                subgoal = Subgoal(
                    description=sg_data['description'],
                    label=sg_data.get('label', ''),
                    project=existing_project,
                    order=index
                )
                db.session.add(subgoal)
            
            db.session.commit()
            return jsonify({"success": True, "message": "Project updated successfully", "id": existing_project.id})
        
        # Create new project if no existing project found
        project = Project(
            name=data['name'],
            main_goal=data['main_goal']
        )
        db.session.add(project)
        
        for index, sg_data in enumerate(data.get('subgoals', [])):
            subgoal = Subgoal(
                description=sg_data['description'],
                label=sg_data.get('label', ''),
                project=project,
                order=index
            )
            db.session.add(subgoal)
        
        db.session.commit()
        return jsonify({"success": True, "message": "Project saved successfully", "id": project.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/projects/<int:project_id>", methods=["GET"])
def load_project(project_id):
    project = Project.query.get_or_404(project_id)
    return jsonify({
        "id": project.id,
        "name": project.name,
        "main_goal": project.main_goal,
        "subgoals": [{
            "id": sg.id,
            "description": sg.description,
            "label": sg.label,
            "time_spent": sg.time_spent,
            "notes": sg.notes,
            "completed": sg.completed,
            "order": sg.order
        } for sg in sorted(project.subgoals, key=lambda x: x.order or 0)]
    })

@app.route("/api/projects/<int:project_id>", methods=["DELETE"])
def delete_project(project_id):
    try:
        project = Project.query.get_or_404(project_id)
        db.session.delete(project)
        db.session.commit()
        return jsonify({"success": True, "message": "Project deleted successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/subgoals/reorder", methods=["POST"])
def reorder_subgoals():
    try:
        data = request.get_json()
        for item in data:
            subgoal = Subgoal.query.get(item['id'])
            if subgoal:
                subgoal.order = item['order']
        db.session.commit()
        return jsonify({"success": True, "message": "Subgoals reordered successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }

        system_message = """
        You are a project management assistant specialized in:
        - Breaking down projects into manageable subgoals
        - Providing time management advice
        - Suggesting productivity techniques
        - Helping with project planning and organization
        Please provide concise, practical advice.
        """

        model_name = data.get('model', 'gpt-4o')
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": data['message']}
            ]
        }

        response = requests.post(
            f"{API_BASE_URL}chat/completions",
            headers=headers,
            json=payload
        )

        if response.status_code != 200:
            return jsonify({"error": "API request failed"}), response.status_code

        response_data = response.json()
        return jsonify({
            "response": response_data['choices'][0]['message']['content'],
            "model": model_name
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/models", methods=["GET"])
def get_models():
    try:
        with open(json_file_path, 'r') as f:
            models_data = json.load(f)
        return jsonify(models_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Initialize database
def init_db():
    with app.app_context():
        db.create_all()
        print("Database initialized successfully!")

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5001)