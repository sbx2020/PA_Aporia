document.addEventListener('DOMContentLoaded', function() {
    const modelSelect = document.getElementById('model-select');
    let currentModel = null;

    // Function to load models from local JSON file (updated path)
    async function loadModels() {
        try {
            const response = await fetch('/static/js/electronjsoncombined_edit.json'); // Corrected path
            if (!response.ok) {
                throw new Error('Failed to load models');
            }
            const data = await response.json();
            return data.models;
        } catch (error) {
            console.error('Error loading models:', error);
            return [];
        }
    }

    // Function to update model selection UI
    function updateModelSelect(models) {
        modelSelect.innerHTML = '<option value="">Select Model</option>';

        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name; // Use model.name as ID
            option.textContent = model.name;
            modelSelect.appendChild(option);
        });

        const savedModel = localStorage.getItem('selectedModel');
        if (savedModel) {
            modelSelect.value = savedModel;
            currentModel = savedModel;
        }
    }

    // Function to handle model selection
    function handleModelSelection(modelId) {
        currentModel = modelId;
        localStorage.setItem('selectedModel', modelId);

        const modelName = modelSelect.options[modelSelect.selectedIndex].text;
        console.log(`Selected model: ${modelName} (${modelId})`);

        const event = new CustomEvent('modelChanged', {
            detail: {
                modelId: modelId,
                modelName: modelName
            }
        });
        document.dispatchEvent(event);
    }

    // Initialize models (handle the promise)
    loadModels().then(models => {
        updateModelSelect(models);
    }).catch(error => {
        console.error("Failed to load models:", error);
    });

    modelSelect.addEventListener('change', function() {
        const selectedModel = this.value;
        if (selectedModel) {
            handleModelSelection(selectedModel);
        }
    });

    window.ModelManager = {
        getCurrentModel: function() {
            return currentModel;
        }
    };
});