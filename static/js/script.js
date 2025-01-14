// Constants and Configuration
const CONFIG = {
    API_ENDPOINTS: {
        MODELS: '/api/models',
        CHAT: '/api/chat'
    },
    STORAGE_KEYS: {
        PROJECTS: 'projects'
    },
    DEFAULT_VALUES: {
        SUBGOAL_NAME: 'Subgoal'
    }
};

// State Management
const AppState = {
    projects: [],
    chatHistory: [],
    selectedModel: null,
    timers: {},
    countdownInterval: null,
    activeSubgoalDescriptionListener: null
};

// Utility Functions
const Utils = {
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        return [hours, minutes, remainingSeconds]
            .map(num => num.toString().padStart(2, '0'))
            .join(':');
    },

    generateId() {
        return Date.now();
    },

    saveToLocalStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    getFromLocalStorage(key) {
        return JSON.parse(localStorage.getItem(key));
    }
};

// API Service
const ApiService = {
    async loadModels() {
        try {
            const response = await fetch(CONFIG.API_ENDPOINTS.MODELS);
            if (!response.ok) throw new Error('Failed to load models');
            return await response.json();
        } catch (error) {
            console.error('Error loading models:', error);
            throw error;
        }
    },

    // UPDATED: sendMessage function to send the request to your Flask app
    async sendMessage(message, model) {
        try {
            // Send the request to /api/chat (your Flask route)
            const response = await fetch(CONFIG.API_ENDPOINTS.CHAT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    model: model || 'gpt-4o' // Send the selected model (default to gpt-4o)
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error data from API:", errorData)
                throw new Error('Failed to send message');
            }

            const data = await response.json();
            console.log('API Response:', data); // Log the API response for debugging

            // Update chat history
            AppState.chatHistory.push({ role: 'user', content: message });
            AppState.chatHistory.push({ role: 'assistant', content: data.response });

            // Update the chat messages UI
            UIManager.updateChatMessages();

            return data;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }
};

// Project Manager
const ProjectManager = {
    createProject(name, mainGoal) {
        return {
            id: Utils.generateId(),
            name,
            mainGoal,
            subgoals: []
        };
    },

    createSubgoal() {
        return {
            id: Utils.generateId(),
            name: CONFIG.DEFAULT_VALUES.SUBGOAL_NAME,
            description: '',
            timeSpent: 0,
            completed: false
        };
    },

    saveProject(project) {
        const existingIndex = AppState.projects.findIndex(p => p.name === project.name);
        if (existingIndex !== -1) {
            AppState.projects[existingIndex] = project;
        } else {
            AppState.projects.push(project);
        }
        Utils.saveToLocalStorage(CONFIG.STORAGE_KEYS.PROJECTS, AppState.projects);

        // Send project data to the backend to save in the database
        fetch('/api/projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(project)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to save project');
            }
            return response.json();
        })
        .then(data => {
            console.log('Project saved:', data);
            // Optionally, update the UI or show a success message
        })
        .catch(error => {
            console.error('Error saving project:', error);
            // Handle the error, display an error message to the user, etc.
        });
    },

    deleteProject(projectId) {
        AppState.projects = AppState.projects.filter(p => p.id !== projectId);
        Utils.saveToLocalStorage(CONFIG.STORAGE_KEYS.PROJECTS, AppState.projects);
    }
};

// UI Manager
const UIManager = {
    updateProjectDropdown() {
        const dropdown = document.getElementById('project-select');
        dropdown.innerHTML = '<option value="">Select Project</option>';
        AppState.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            dropdown.appendChild(option);
        });
    },

    clearForm() {
        document.getElementById('project-name').value = '';
        document.getElementById('main-goal').value = '';
        document.getElementById('subgoalGrid').innerHTML = '';
        this.clearActiveSubgoalArea();
    },

    clearActiveSubgoalArea() {
        document.getElementById('activeSubgoalDescription').value = '';
        document.getElementById('activeTimerDisplay').textContent = '00:00:00';
        if (AppState.activeSubgoalDescriptionListener) {
            document.getElementById('activeSubgoalDescription')
                .removeEventListener('input', AppState.activeSubgoalDescriptionListener);
            AppState.activeSubgoalDescriptionListener = null;
        }
    },

    // Function to update the chat messages UI
    updateChatMessages() {
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = ''; // Clear existing messages

        AppState.chatHistory.forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.classList.add(msg.role === 'user' ? 'user-message' : 'assistant-message');
            messageElement.textContent = msg.content;
            chatMessages.appendChild(messageElement);
        });

        // Scroll to the bottom of the chat messages
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
};

// Timer Manager
const TimerManager = {
    // Function to find a subgoal by its ID
    getSubgoalById(subgoalId) {
        for (let project of AppState.projects) {
            const subgoal = project.subgoals.find(sg => sg.id === subgoalId);
            if (subgoal) return subgoal;
        }
        return null;
    },

    startTimer(subgoalId) {
        if (AppState.timers[subgoalId]) return;

        const subgoal = this.getSubgoalById(subgoalId); // Use getSubgoalById
        if (!subgoal) return;

        const startTime = Date.now() - (subgoal.timeSpent * 1000);
        AppState.timers[subgoalId] = setInterval(() => {
            subgoal.timeSpent = Math.floor((Date.now() - startTime) / 1000);
            document.getElementById('activeTimerDisplay').textContent =
                Utils.formatTime(subgoal.timeSpent);
            this.updateStoredTime(subgoalId);
        }, 1000);
    },

    stopTimer(subgoalId) {
        if (AppState.timers[subgoalId]) {
            clearInterval(AppState.timers[subgoalId]);
            delete AppState.timers[subgoalId];
            this.updateStoredTime(subgoalId);
        }
    },

    updateStoredTime(subgoalId) {
        const subgoal = this.getSubgoalById(subgoalId);
        if (subgoal) {
            console.log(`Updating time for subgoal ${subgoalId}: ${subgoal.timeSpent}`);
             fetch(`/api/timer/${subgoalId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'subgoal', time_spent: subgoal.timeSpent })
              })
            .then(response => { /* Handle response */ })
            .catch(error => console.error('Error updating timer:', error));
         }
     }

};

// Event Handlers
function handleAddSubgoal() {
    const subgoalGrid = document.getElementById('subgoalGrid');
    const newSubgoal = ProjectManager.createSubgoal();

    const subgoalElement = document.createElement('div');
    subgoalElement.id = `subgoal-${newSubgoal.id}`;
    subgoalElement.className = 'subgoal-item';
    subgoalElement.dataset.subgoalId = newSubgoal.id; // Set the data attribute

    subgoalElement.innerHTML = `
        <textarea placeholder="Enter subgoal description"></textarea>
        <button class="start-timer">Start</button>
        <button class="stop-timer">Stop</button>
        <button class="reset-timer">Reset</button>
        <span class="timer-display">00:00:00</span>
        <button class="complete-subgoal">Complete</button>
        <button class="remove-subgoal">X</button>
    `;

    subgoalGrid.appendChild(subgoalElement);
    attachSubgoalEventListeners(subgoalElement);
}

// Event Handlers (handleSaveProject needs to be defined before this)
function handleSaveProject() {
    const projectName = document.getElementById('project-name').value;
    const mainGoal = document.getElementById('main-goal').value;
    const subgoalElements = document.querySelectorAll('.subgoal-item');

    const subgoals = Array.from(subgoalElements).map(subgoalElement => {
        const subgoalId = parseInt(subgoalElement.dataset.subgoalId, 10);
        const description = subgoalElement.querySelector('textarea').value;
        const timerDisplay = subgoalElement.querySelector('.timer-display').textContent;
        const timeSpent = parseTime(timerDisplay); // You still need to implement parseTime

        return {
            id: subgoalId,
            description,
            timeSpent,
            completed: false // Adjust as needed
        };
    });

     const project = {
        name: projectName,
        main_goal: mainGoal,
        subgoals: subgoals
    };

    ProjectManager.saveProject(project);
    UIManager.updateProjectDropdown();
}

// Function to load a project
async function handleLoadProject() {
    const projectSelect = document.getElementById('project-select');
    const selectedProjectId = projectSelect.value;

    if (selectedProjectId) {
        try {
            const response = await fetch(`/api/projects`);
            if (!response.ok) throw new Error('Failed to load projects');
            const projects = await response.json();

            console.log("all projects:", projects);

            const selectedProject = projects.find(p => String(p.id) === selectedProjectId);

            console.log("selected project:", selectedProject);

            if (selectedProject) {
                document.getElementById('project-name').value = selectedProject.name;
                document.getElementById('main-goal').value = selectedProject.main_goal;

                // Clear the subgoal grid
                document.getElementById('subgoalGrid').innerHTML = '';

                // Rebuild the subgoal grid with data
               if (selectedProject.subgoals) {
                    selectedProject.subgoals.forEach(subgoal => {
                      const subgoalElement = document.createElement('div');
                      subgoalElement.id = `subgoal-${subgoal.id}`;
                      subgoalElement.className = 'subgoal-item';
                      subgoalElement.dataset.subgoalId = subgoal.id;
                      subgoalElement.innerHTML = `
                          <textarea placeholder="Enter subgoal description">${subgoal.description}</textarea>
                          <button class="start-timer">Start</button>
                          <button class="stop-timer">Stop</button>
                          <button class="reset-timer">Reset</button>
                          <span class="timer-display">${Utils.formatTime(subgoal.timeSpent)}</span>
                          <button class="complete-subgoal">Complete</button>
                          <button class="remove-subgoal">X</button>
                      `;
                      document.getElementById('subgoalGrid').appendChild(subgoalElement);
                       attachSubgoalEventListeners(subgoalElement);
                    });
                }
            } else {
                 console.error('Project not found');
                 UIManager.clearForm();
                  alert("Project does not exist!")
            }

        } catch (error) {
            console.error('Error loading project:', error);
            alert("Could not retrieve list of projects!")
        }
    }
     else {
        console.error("No Project selected to load.")
        UIManager.clearForm();
        alert("No project selected to load!");
    }
}

// Delete project function
async function handleDeleteProject() {
    const projectSelect = document.getElementById('project-select');
    const projectId = projectSelect.value;

    if (projectId) {
        try {
            ProjectManager.deleteProject(projectId);
            UIManager.updateProjectDropdown();
        } catch (error) {
            console.error("Failed to delete project:", error);
            // Optionally display an error message to the user
        }
    }
}

// Prioritized connection handler
function handlePrioritizedConnections() {
    // Implement this according to your intended functionality
    const dropdown = document.getElementById('project-select');

    // for testing purposes, will log value to the console
    console.log(dropdown.value)
}


function parseTime(timeString) {
    const parts = timeString.split(':').map(Number);

    // Check if the time string has hours, minutes, and seconds
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else {
        console.error("Invalid time format:", timeString);
        return 0; // Return 0 or handle the error as appropriate for your application
    }
}

    // Function to attach event listeners to new subgoals
    function attachSubgoalEventListeners(subgoalElement) {
      const subgoalId = parseInt(subgoalElement.dataset.subgoalId, 10);

      const startTimerButton = subgoalElement.querySelector('.start-timer');
      const stopTimerButton = subgoalElement.querySelector('.stop-timer');
      const resetTimerButton = subgoalElement.querySelector('.reset-timer');
      const completeButton = subgoalElement.querySelector('.complete-subgoal');
      const removeButton = subgoalElement.querySelector('.remove-subgoal');


      startTimerButton.addEventListener('click', () => {
          TimerManager.startTimer(subgoalId);
      });

      stopTimerButton.addEventListener('click', () => {
          TimerManager.stopTimer(subgoalId);
      });

       resetTimerButton.addEventListener('click', () => {
           TimerManager.stopTimer(subgoalId);
            const subgoal = TimerManager.getSubgoalById(subgoalId);
            subgoal.timeSpent = 0;
            document.getElementById('activeTimerDisplay').textContent =
                Utils.formatTime(subgoal.timeSpent);
           console.log(`Timer reset on subgoal ${subgoalId}: time is now 0`);

        });

      completeButton.addEventListener('click', () => {
        const subgoal = TimerManager.getSubgoalById(subgoalId);
        subgoal.completed = true;
          console.log(`Subgoal ${subgoalId} completed`);

    });

      removeButton.addEventListener('click', () => {
          subgoalElement.remove();
            console.log(`Subgoal ${subgoalId} removed`);

      });
    }


function initializeEventListeners() {
    // Add Subgoal button
    document.getElementById('add-subgoal').addEventListener('click', handleAddSubgoal);

    // Save Project button
    document.getElementById('save-project').addEventListener('click', handleSaveProject);

        // Prioritized connections button
    const prioButton = document.getElementById('project-select');
    prioButton.addEventListener('change', handlePrioritizedConnections);


    // Load project button
    document.getElementById('load-project').addEventListener('click', handleLoadProject);

    // Delete project button
    document.getElementById('delete-project').addEventListener('click', handleDeleteProject);


    // Send Message button
    document.getElementById('send-message').addEventListener('click', async () => {
        const messageInput = document.getElementById('chat-input');
        const message = messageInput.value.trim();
        const selectedModel = ModelManager.getCurrentModel();

        if (message) {
            try {
                await ApiService.sendMessage(message, selectedModel);
                messageInput.value = '';
            } catch (error) {
                console.error("Failed to send message:", error);
            }
        }
    });

     document.getElementById('subgoalGrid').addEventListener('DOMNodeInserted', function (event) {
        if (event.target && event.target.classList && event.target.classList.contains('subgoal-item')) {
            attachSubgoalEventListeners(event.target);
        }
    });

    // ... other event listeners ...
}

// Initialize Application
function initializeApp() {
    AppState.projects = Utils.getFromLocalStorage(CONFIG.STORAGE_KEYS.PROJECTS) || [];
    UIManager.updateProjectDropdown();
    initializeEventListeners();
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeApp);