// Todo PWA with Service Worker, API, and Offline Support
class TodoPWA {
    constructor() {
        this.todos = JSON.parse(localStorage.getItem('todos')) || [];
        this.inspirationQuotes = [];
        this.isOnline = navigator.onLine;
        this.init();
    }

    async init() {
        this.registerServiceWorker();
        this.setupEventListeners();
        this.renderTodos();
        this.createOfflineIndicator();
        this.checkNetworkStatus();
        await this.loadInspirationData();
        this.showWelcomeMessage();
    }

    // Service Worker Registration
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('Service Worker registered successfully:', registration);
                
                // Listen for messages from service worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event.data);
                });
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showToast('App updated! Refresh to see changes.', 'info');
                        }
                    });
                });
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    // Handle messages from service worker
    handleServiceWorkerMessage(data) {
        switch (data.type) {
            case 'NETWORK_STATUS':
                this.updateNetworkStatus(data.online);
                break;
            case 'SYNC_TODOS':
                this.syncTodos();
                break;
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Network status listeners
        window.addEventListener('online', () => this.updateNetworkStatus(true));
        window.addEventListener('offline', () => this.updateNetworkStatus(false));
        
        // Todo input listener
        document.getElementById('todoInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTodo();
        });
    }

    // Load inspiration data from API
    async loadInspirationData() {
        try {
            this.showToast('Loading inspiration quotes...', 'info');
            
            const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=10');
            const posts = await response.json();
            
            // Transform posts into inspiration quotes
            this.inspirationQuotes = posts.map(post => ({
                id: post.id,
                title: post.title,
                text: post.body.substring(0, 100) + '...'
            }));
            
            this.displayInspirationQuote();
            this.showToast('Inspiration quotes loaded!', 'success');
            
        } catch (error) {
            console.error('Failed to load inspiration data:', error);
            this.loadCachedInspirationData();
            this.showToast('Using cached inspiration quotes (offline mode)', 'warning');
        }
    }

    // Load cached inspiration data
    loadCachedInspirationData() {
        const cached = localStorage.getItem('inspirationQuotes');
        if (cached) {
            this.inspirationQuotes = JSON.parse(cached);
            this.displayInspirationQuote();
        } else {
            // Fallback quotes
            this.inspirationQuotes = [
                { id: 1, title: "Stay Productive", text: "Every task completed is a step towards your goals..." },
                { id: 2, title: "Keep Going", text: "Progress, not perfection, is the key to success..." },
                { id: 3, title: "You Got This", text: "Small steps daily lead to big changes yearly..." }
            ];
            this.displayInspirationQuote();
        }
    }

    // Display random inspiration quote
    displayInspirationQuote() {
        if (this.inspirationQuotes.length === 0) return;
        
        const randomQuote = this.inspirationQuotes[Math.floor(Math.random() * this.inspirationQuotes.length)];
        
        // Create or update inspiration section
        let inspirationDiv = document.getElementById('inspiration');
        if (!inspirationDiv) {
            inspirationDiv = document.createElement('div');
            inspirationDiv.id = 'inspiration';
            inspirationDiv.className = 'inspiration-quote';
            document.querySelector('.container').appendChild(inspirationDiv);
        }
        
        inspirationDiv.innerHTML = `
            <h3>💡 ${randomQuote.title}</h3>
            <p>${randomQuote.text}</p>
        `;
        
        // Cache the quotes
        localStorage.setItem('inspirationQuotes', JSON.stringify(this.inspirationQuotes));
    }

    // Save todos to localStorage
    saveTodos() {
        localStorage.setItem('todos', JSON.stringify(this.todos));
    }

    // Render todos list
    renderTodos() {
        const todoList = document.getElementById('todoList');
        todoList.innerHTML = '';
        
        if (this.todos.length === 0) {
            const emptyState = document.createElement('li');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = '📝 No tasks yet. Add one above!';
            todoList.appendChild(emptyState);
            return;
        }
        
        this.todos.forEach((todo, index) => {
            const li = document.createElement('li');
            li.className = 'todo-item';
            li.innerHTML = `
                <span class="todo-text">${todo}</span>
                <button class="delete-btn" onclick="app.deleteTodo(${index})">🗑️</button>
            `;
            todoList.appendChild(li);
        });
    }

    // Add new todo
    addTodo() {
        const input = document.getElementById('todoInput');
        const todoText = input.value.trim();
        
        if (todoText) {
            this.todos.push(todoText);
            this.saveTodos();
            this.renderTodos();
            input.value = '';
            this.showToast('Task added successfully!', 'success');
            
            // Refresh inspiration quote occasionally
            if (Math.random() < 0.3) {
                this.displayInspirationQuote();
            }
        }
    }

    // Delete todo
    deleteTodo(index) {
        const deletedTodo = this.todos[index];
        this.todos.splice(index, 1);
        this.saveTodos();
        this.renderTodos();
        this.showToast(`"${deletedTodo}" deleted`, 'info');
    }

    // Update network status
    updateNetworkStatus(online) {
        this.isOnline = online;
        const indicator = document.getElementById('network-indicator');
        
        if (online) {
            indicator.className = 'network-indicator online';
            indicator.innerHTML = '🌐 Online';
            this.hideConnectionLostMessage();
            this.showToast('Connection restored! 🎉', 'success');
            // Reload inspiration data when back online
            this.loadInspirationData();
        } else {
            indicator.className = 'network-indicator offline';
            indicator.innerHTML = '📴 Offline';
            this.showConnectionLostMessage();
        }
    }

    // Create offline indicator
    createOfflineIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'network-indicator';
        indicator.className = this.isOnline ? 'network-indicator online' : 'network-indicator offline';
        indicator.innerHTML = this.isOnline ? '🌐 Online' : '📴 Offline';
        
        document.body.appendChild(indicator);
    }

    // Check network status
    async checkNetworkStatus() {
        if (!navigator.serviceWorker.controller) return;
        
        try {
            const messageChannel = new MessageChannel();
            
            navigator.serviceWorker.controller.postMessage({
                type: 'CHECK_NETWORK'
            }, [messageChannel.port2]);
            
            messageChannel.port1.onmessage = (event) => {
                this.updateNetworkStatus(event.data.online);
            };
        } catch (error) {
            console.error('Network check failed:', error);
        }
    }

    // Show connection lost message
    showConnectionLostMessage() {
        let messageDiv = document.getElementById('connection-lost');
        
        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.id = 'connection-lost';
            messageDiv.className = 'connection-lost-message';
            document.body.appendChild(messageDiv);
        }
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-icon">📡</div>
                <h3>Connection Lost</h3>
                <p>You're currently offline, but don't worry!</p>
                <p>Your todos are saved locally and will sync when you're back online.</p>
                <div class="pulse-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        messageDiv.style.display = 'flex';
        setTimeout(() => messageDiv.classList.add('show'), 100);
    }

    // Hide connection lost message
    hideConnectionLostMessage() {
        const messageDiv = document.getElementById('connection-lost');
        if (messageDiv) {
            messageDiv.classList.remove('show');
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 300);
        }
    }

    // Show toast notification
    showToast(message, type = 'info') {
        let toast = document.getElementById('toast');
        
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.style.display = 'block';
        
        setTimeout(() => toast.classList.add('show'), 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.style.display = 'none', 300);
        }, 3000);
    }

    // Show welcome message
    showWelcomeMessage() {
        const welcomeMessages = [
            "Welcome back! Ready to be productive? 🚀",
            "Let's tackle those tasks! 💪",
            "Your todo list awaits! ✨",
            "Time to get things done! 🎯"
        ];
        
        const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
        this.showToast(randomMessage, 'success');
    }

    // Sync todos (called by service worker)
    syncTodos() {
        console.log('Syncing todos...');
        this.showToast('Syncing your data...', 'info');
        // In a real app, this would sync with a server
    }
}

// Global functions for backward compatibility
function addTodo() {
    app.addTodo();
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TodoPWA();
});

// Global app reference for onclick handlers
let app;