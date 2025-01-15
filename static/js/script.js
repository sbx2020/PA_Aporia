
// State Management
const AppState = {
    subgoals: [],
    activeSubgoalId: null,
    timer: {
        interval: null,
        seconds: 0,
        isRunning: false
    }
};

// Utility Functions
function createSubgoalBlock(id, label = "") {
    const block = document.createElement("div");
    block.className = "subgoal-block";
    block.dataset.id = id;
    block.textContent = label || "Subgoal";
    block.draggable = true;

    // Add remove button
    const removeBtn = document.createElement("span");
    removeBtn.className = "remove-subgoal";
    removeBtn.innerHTML = "×";
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        block.remove();
        AppState.subgoals = AppState.subgoals.filter(sg => sg.id !== parseInt(id));
    };
    block.appendChild(removeBtn);

    // Double-click to rename
    block.addEventListener("dblclick", (e) => {
        if (e.target !== removeBtn) {
            const newLabel = prompt("Rename subgoal:", block.textContent);
            if (newLabel) {
                block.textContent = newLabel;
                block.appendChild(removeBtn);
                const subgoal = AppState.subgoals.find(sg => sg.id === parseInt(id));
                if (subgoal) subgoal.label = newLabel;
            }
        }
    });

    // Click to edit description
    block.addEventListener("click", () => {
        AppState.activeSubgoalId = parseInt(id);
        document.querySelectorAll(".subgoal-block").forEach(b => b.classList.remove("active"));
        block.classList.add("active");
        const subgoal = AppState.subgoals.find(sg => sg.id === parseInt(id));
        document.getElementById("subgoal-input").value = subgoal ? subgoal.description || "" : "";
    });

    // Drag and drop
    block.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", e.target.dataset.id);
        block.classList.add("dragging");
    });

    block.addEventListener("dragend", () => {
        block.classList.remove("dragging");
        updateSubgoalOrder();
    });

    return block;
}

// Project Functions
function newProject() {
    document.getElementById("project-name").value = "";
    document.getElementById("main-goal").value = "";
    document.getElementById("subgoal-input").value = "";
    document.getElementById("subgoalGrid").innerHTML = "";
    AppState.subgoals = [];
    AppState.activeSubgoalId = null;
    resetTimer();
}

function saveProject() {
    const projectName = document.getElementById("project-name").value.trim();
    const mainGoal = document.getElementById("main-goal").value.trim();

    if (!projectName) {
        alert("Please enter a project name.");
        return;
    }

    const projectData = {
        name: projectName,
        main_goal: mainGoal,
        subgoals: AppState.subgoals.map((sg, index) => ({
            description: sg.description || "",
            label: sg.label || "Subgoal",
            order: index
        }))
    };

    fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert("Project saved successfully!");
            loadProjectList();
        } else {
            alert("Failed to save project: " + data.message);
        }
    })
    .catch(error => {
        console.error("Error:", error);
        alert("Error saving project");
    });
}

function loadProject() {
    const projectId = document.getElementById("project-select").value;
    if (!projectId) {
        alert("Please select a project to load.");
        return;
    }

    fetch(`/api/projects/${projectId}`)
    .then(response => response.json())
    .then(project => {
        document.getElementById("project-name").value = project.name;
        document.getElementById("main-goal").value = project.main_goal;
        
        const subgoalGrid = document.getElementById("subgoalGrid");
        subgoalGrid.innerHTML = "";
        AppState.subgoals = [];
        
        project.subgoals
            .sort((a, b) => a.order - b.order)
            .forEach((subgoal, index) => {
                const id = Date.now() + index;
                const block = createSubgoalBlock(id, subgoal.label);
                subgoalGrid.appendChild(block);
                AppState.subgoals.push({
                    id: id,
                    label: subgoal.label,
                    description: subgoal.description,
                    order: subgoal.order
                });
            });
    })
    .catch(error => {
        console.error("Error:", error);
        alert("Error loading project");
    });
}

function loadProjectList() {
    fetch("/api/projects")
    .then(response => response.json())
    .then(projects => {
        const select = document.getElementById("project-select");
        select.innerHTML = '<option value="">Select a project...</option>';
        projects.forEach(project => {
            const option = document.createElement("option");
            option.value = project.id;
            option.textContent = project.name;
            select.appendChild(option);
        });
    })
    .catch(error => console.error("Error loading projects:", error));
}

function deleteProject() {
    const projectId = document.getElementById("project-select").value;
    if (!projectId) {
        alert("Please select a project to delete.");
        return;
    }

    if (!confirm("Are you sure you want to delete this project?")) {
        return;
    }

    fetch(`/api/projects/${projectId}`, {
        method: "DELETE"
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert("Project deleted successfully!");
            newProject();
            loadProjectList();
        } else {
            alert("Failed to delete project: " + data.message);
        }
    })
    .catch(error => {
        console.error("Error:", error);
        alert("Error deleting project");
    });
}

// Timer Functions
function updateTimerDisplay() {
    const minutes = Math.floor(AppState.timer.seconds / 60);
    const seconds = AppState.timer.seconds % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.querySelector('.timer-display').textContent = display;
}

function startTimer() {
    if (!AppState.timer.isRunning) {
        AppState.timer.isRunning = true;
        AppState.timer.interval = setInterval(() => {
            AppState.timer.seconds++;
            updateTimerDisplay();
        }, 1000);
    }
}

function stopTimer() {
    if (AppState.timer.isRunning) {
        clearInterval(AppState.timer.interval);
        AppState.timer.isRunning = false;
    }
}

function resetTimer() {
    stopTimer();
    AppState.timer.seconds = 0;
    updateTimerDisplay();
}

// Subgoal Order Management
function updateSubgoalOrder() {
    const blocks = document.querySelectorAll('.subgoal-block');
    AppState.subgoals = Array.from(blocks).map((block, index) => {
        const subgoal = AppState.subgoals.find(sg => sg.id === parseInt(block.dataset.id)) || {};
        return {
            ...subgoal,
            id: parseInt(block.dataset.id),
            order: index,
            label: block.textContent.replace('×', '').trim()
        };
    });
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    loadProjectList();

    // Save subgoal description when input changes
    document.getElementById("subgoal-input").addEventListener("input", (e) => {
        if (AppState.activeSubgoalId) {
            const subgoal = AppState.subgoals.find(sg => sg.id === AppState.activeSubgoalId);
            if (subgoal) {
                subgoal.description = e.target.value;
            }
        }
    });

    document.getElementById("new-project").addEventListener("click", newProject);
    document.getElementById("add-subgoal").addEventListener("click", () => {
        const id = Date.now();
        const block = createSubgoalBlock(id);
        document.getElementById("subgoalGrid").appendChild(block);
        AppState.subgoals.push({
            id: id,
            label: "Subgoal",
            description: "",
            order: AppState.subgoals.length
        });
    });

    document.getElementById("save-project").addEventListener("click", saveProject);
    document.getElementById("load-project").addEventListener("click", loadProject);
    document.getElementById("delete-project").addEventListener("click", deleteProject);
    document.getElementById("start-timer").addEventListener("click", startTimer);
    document.getElementById("stop-timer").addEventListener("click", stopTimer);
    document.getElementById("reset-timer").addEventListener("click", resetTimer);

    // Initialize timer display
    updateTimerDisplay();

});

// Add event listener for the send message button
document.getElementById("send-message").addEventListener("click", () => {
    const userInput = document.getElementById("user-input").value.trim();
    if (!userInput) {
        alert("Please enter a message.");
        return;
    }

    const currentModel = window.ModelManager.getCurrentModel();
    if (!currentModel) {
        alert("Please select an AI model.");
        return;
    }

    // Display user message
    const chatMessages = document.getElementById("chat-messages");
    const userMessage = document.createElement("div");
    userMessage.className = "user-message";
    userMessage.textContent = userInput;
    chatMessages.appendChild(userMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Clear input field
    document.getElementById("user-input").value = "";

    // Simulate AI response (for demonstration purposes)
    setTimeout(() => {
        const assistantMessage = document.createElement("div");
        assistantMessage.className = "assistant-message";
        assistantMessage.textContent = "This is a simulated AI response.";
        chatMessages.appendChild(assistantMessage);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 1000);
});