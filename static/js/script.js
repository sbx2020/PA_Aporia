// State Management
const AppState = {
    subgoals: [],
    activeSubgoalId: null,
    projects: []
};

// Utility Functions
function createSubgoalBlock(id, label = "") {
    const block = document.createElement("div");
    block.className = "subgoal-block";
    block.dataset.id = id;
    block.textContent = label || "Subgoal";

    // Double-click to rename
    block.addEventListener("dblclick", () => {
        const newLabel = prompt("Enter a short name for this subgoal:", block.textContent);
        if (newLabel) {
            block.textContent = newLabel;
            const subgoal = AppState.subgoals.find(sg => sg.id === id);
            if (subgoal) subgoal.label = newLabel;
        }
    });

    // Click to activate
    block.addEventListener("click", () => {
        setActiveSubgoal(id);
    });

    return block;
}

function setActiveSubgoal(id) {
    if (AppState.activeSubgoalId !== null) {
        const activeSubgoal = AppState.subgoals.find(sg => sg.id === AppState.activeSubgoalId);
        if (activeSubgoal) {
            activeSubgoal.description = document.getElementById("subgoal-input").value;
        }
    }

    AppState.activeSubgoalId = id;
    const activeSubgoal = AppState.subgoals.find(sg => sg.id === id);
    document.getElementById("subgoal-input").value = activeSubgoal ? activeSubgoal.description : "";

    document.querySelectorAll(".subgoal-block").forEach(block => block.classList.remove("active"));
    const activeBlock = document.querySelector(`.subgoal-block[data-id='${id}']`);
    if (activeBlock) activeBlock.classList.add("active");
}

// Event Handlers
document.getElementById("add-subgoal").addEventListener("click", () => {
    const id = Date.now();
    AppState.subgoals.push({ id, description: "", label: "" });

    const subgoalGrid = document.getElementById("subgoalGrid");
    const newBlock = createSubgoalBlock(id);
    subgoalGrid.appendChild(newBlock);

    setActiveSubgoal(id);
});

document.getElementById("save-project").addEventListener("click", () => {
    const projectName = document.getElementById("project-name").value.trim();
    const mainGoal = document.getElementById("main-goal").value.trim();

    if (!projectName) {
        alert("Please enter a project name.");
        return;
    }

    const project = {
        id: Date.now(),
        name: projectName,
        mainGoal,
        subgoals: [...AppState.subgoals]
    };

    AppState.projects.push(project);
    alert("Project saved successfully!");
});

document.getElementById("load-project").addEventListener("click", () => {
    const projectSelect = document.getElementById("project-select");
    const projectId = projectSelect.value;

    if (!projectId) {
        alert("Please select a project to load.");
        return;
    }

    const project = AppState.projects.find(p => p.id === parseInt(projectId, 10));
    if (project) {
        document.getElementById("project-name").value = project.name;
        document.getElementById("main-goal").value = project.mainGoal;

        AppState.subgoals = project.subgoals;
        const subgoalGrid = document.getElementById("subgoalGrid");
        subgoalGrid.innerHTML = "";

        AppState.subgoals.forEach(subgoal => {
            const block = createSubgoalBlock(subgoal.id, subgoal.label);
            subgoalGrid.appendChild(block);
        });
    }
});

document.getElementById("delete-project").addEventListener("click", () => {
    const projectSelect = document.getElementById("project-select");
    const projectId = projectSelect.value;

    if (!projectId) {
        alert("Please select a project to delete.");
        return;
    }

    AppState.projects = AppState.projects.filter(p => p.id !== parseInt(projectId, 10));
    alert("Project deleted successfully!");
});