from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import os
import json
import requests

app = Flask(__name__)
username = 'sbx202x'

# Construct absolute paths
app_dir = os.path.dirname(os.path.abspath(__file__))
database_path = os.path.join(app_dir, "sbx202x_Aporia_Sched.db")
json_file_path = os.path.join(app_dir, 'static', 'js', 'electronjsoncombined_edit.json')

app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:////{database_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# API configuration
API_BASE_URL = "https://api.electronhub.top/v1/"
API_KEY = "ek-BHhUiYb8F5J1TDxnEvnOddeFBWrc6ArAKBqW1dkwelgcRom3VS"  # Your API key

# --- Database Models ---
class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    main_goal = db.Column(db.Text)
    subgoals = db.relationship('Subgoal', backref='project', lazy=True)

class Subgoal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.Text, nullable=False)
    time_spent = db.Column(db.Integer, default=0)
    notes = db.Column(db.Text)
    completed = db.Column(db.Boolean, default=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.Text, nullable=False)
    time_spent = db.Column(db.Integer, default=0)
    notes = db.Column(db.Text)
    completed = db.Column(db.Boolean, default=False)

# --- Routes ---
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/chat", methods=["POST"])
def chat():
    print("Request received at /api/chat") # Log when the request is received
    data = request.get_json()
    print("Received data:", data) # Log the request data

    try:
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }
        print("Headers:", headers) # Log the headers

        system_message = """
        You are a project management assistant specialized in:
        - Breaking down projects into manageable subgoals
        - Providing time management advice
        - Suggesting productivity techniques
        - Helping with project planning and organization
        Please provide concise, practical advice.
        """

        # Use the model name from the request, defaulting to "gpt-4o"
        model_name = data.get('model', 'gpt-4o')

        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": data['message']}
            ]
        }

        print("Request Payload:", payload)  # Log the constructed payload
        response = requests.post(
            f"{API_BASE_URL}chat/completions",
            headers=headers,
            json=payload
        )

        print("API response status:", response.status_code) # Log the API response status
        print("API response:", response.text)

        if response.status_code != 200:
            return jsonify({"error": "API request failed"}), response.status_code

        response_data = response.json()
        print("API Response:", response_data)
        return jsonify({
            "response": response_data['choices'][0]['message']['content'],
            "model": model_name
        })

    except Exception as e:
        print(f"Error in chat route: {str(e)}") # Log any exceptions
        return jsonify({"error": "An error occurred processing your request"}), 500

# Models configuration route
@app.route("/api/models", methods=["GET"])
def get_models():
    try:
        with open(json_file_path, 'r') as f:
            models_data = json.load(f)

        # Add an 'id' field if it doesn't exist, assuming 'name' can be used as id
        for model in models_data['models']:
            if 'id' not in model:
                model['id'] = model['name']

        return jsonify(models_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Projects routes
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
            "time_spent": sg.time_spent,
            "notes": sg.notes,
            "completed": sg.completed
        } for sg in p.subgoals]
    } for p in projects])

@app.route("/api/projects", methods=["POST"])
def save_project():
    data = request.get_json()
    project = Project(name=data['name'], main_goal=data['main_goal'])
    db.session.add(project)

    for sg_data in data.get('subgoals', []):
        subgoal = Subgoal(description=sg_data['description'], project=project)
        db.session.add(subgoal)

    db.session.commit()
    return jsonify({"message": "Project created", "id": project.id})

# Tasks routes
@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    tasks = Task.query.all()
    return jsonify([{
        "id": t.id,
        "description": t.description,
        "time_spent": t.time_spent,
        "notes": t.notes,
        "completed": t.completed
    } for t in tasks])

@app.route("/api/tasks", methods=["POST"])
def save_task():
    data = request.get_json()
    task = Task(description=data['description'])
    db.session.add(task)
    db.session.commit()
    return jsonify({"message": "Task created", "id": task.id})

# Timer updates
@app.route("/api/timer/<int:item_id>", methods=["PUT"])
def update_timer(item_id):
    data = request.get_json()
    item_type = data.get("type")
    print(f"item_id: {item_id}, type: {item_type}")

    if item_type == "subgoal":
        item = Subgoal.query.get(item_id)
        print("subgoal", item)
    elif item_type == "task":
        item = Task.query.get(item_id)
        print("task", item)
    else:
        return jsonify({"message": "Invalid item type"}), 400

    if not item:
        return jsonify({"message": "Item not found"}), 404

    item.time_spent = data.get("time_spent", item.time_spent)
    print("Updated time to", item.time_spent)
    db.session.commit()
    return jsonify({"message": "Timer updated"})

# Notes updates
@app.route("/api/notes/<int:item_id>", methods=["PUT"])
def update_notes(item_id):
    data = request.get_json()
    item_type = data.get("type")

    if item_type == "subgoal":
        item = Subgoal.query.get(item_id)
    elif item_type == "task":
        item = Task.query.get(item_id)
    else:
        return jsonify({"message": "Invalid item type"}), 400

    if not item:
        return jsonify({"message": "Item not found"}), 404

    item.notes = data.get("notes", item.notes)
    db.session.commit()
    return jsonify({"message": "Notes updated"})

# Initialize database
def init_db():
    with app.app_context():
        db.create_all()
        print("Database initialized successfully!")

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5001)