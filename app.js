// Todo PWA with Service Worker, API, and Offline Support
class TodoPWA {
    constructor() {
        console.log('TodoPWA: Constructor called');
        this.todos = JSON.parse(localStorage.getItem('todos')) || [];
        this.inspirationQuotes = [];
        this.isOnline = navigator.onLine;
        this.quoteTimer = null; // Timer for auto-changing quotes
        this.currentQuoteIndex = 0; // Track current quote index
        this.init();
    }

    async init() {
        console.log('TodoPWA: Initializing...');
        this.registerServiceWorker();
        this.setupEventListeners();
        this.renderTodos();
        this.createOfflineIndicator();
        this.checkNetworkStatus();
        await this.loadInspirationData();
        this.showWelcomeMessage();
        this.startQuoteRotation(); // Start auto-changing quotes
        console.log('TodoPWA: Initialization complete');
    }

    // Service Worker Registration
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                console.log('TodoPWA: Registering service worker...');
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
                // Continue without service worker
                console.log('TodoPWA: Continuing without service worker');
            }
        } else {
            console.log('TodoPWA: Service Worker not supported');
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

        // Cleanup quote timer when page is unloaded
        window.addEventListener('beforeunload', () => {
            this.stopQuoteRotation();
        });

        // Pause quote rotation when page is not visible
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopQuoteRotation();
            } else {
                this.startQuoteRotation();
            }
        });
    }

    // Load inspiration data from API
    async loadInspirationData() {
        try {
            console.log('TodoPWA: Loading inspiration data...');
            this.showToast('Loading inspiration quotes...', 'info');
            
            // Try to fetch from a quotes API that provides English quotes
            const response = await fetch('https://api.quotable.io/quotes?minLength=50&maxLength=150&limit=10');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Transform quotes into inspiration format
            this.inspirationQuotes = data.results.map(quote => ({
                id: quote._id,
                title: `Inspiration by ${quote.author}`,
                text: quote.content
            }));
            
            this.displayInspirationQuote();
            this.showToast('English inspiration quotes loaded!', 'success');
            console.log('TodoPWA: English inspiration data loaded successfully');
            
        } catch (error) {
            console.error('Failed to load inspiration data from quotes API, trying fallback:', error);
            // Fallback to JSONPlaceholder but with better English content
            try {
                const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=5');
                const posts = await response.json();
                
                // Create more meaningful English quotes from posts
                this.inspirationQuotes = posts.map(post => ({
                    id: post.id,
                    title: "Daily Motivation",
                    text: this.generateMotivationalQuote(post.title)
                }));
                
                this.displayInspirationQuote();
                this.showToast('Motivational quotes loaded!', 'success');
            } catch (fallbackError) {
                console.error('Fallback API also failed:', fallbackError);
                this.loadCachedInspirationData();
                this.showToast('Using cached inspiration quotes (offline mode)', 'warning');
            }
        }
    }

    // Start automatic quote rotation every 10 seconds
    startQuoteRotation() {
        // Clear any existing timer
        if (this.quoteTimer) {
            clearInterval(this.quoteTimer);
        }
        
        // Start new timer to change quotes every 10 seconds
        this.quoteTimer = setInterval(() => {
            if (this.inspirationQuotes.length > 0) {
                this.showNextQuote();
            }
        }, 10000); // 10 seconds = 10000 milliseconds
        
        console.log('TodoPWA: Quote rotation started - quotes will change every 10 seconds');
    }

    // Stop quote rotation
    stopQuoteRotation() {
        if (this.quoteTimer) {
            clearInterval(this.quoteTimer);
            this.quoteTimer = null;
            console.log('TodoPWA: Quote rotation stopped');
        }
    }

    // Show next quote in sequence
    showNextQuote() {
        if (this.inspirationQuotes.length === 0) return;
        
        // Move to next quote (cycle back to 0 when reaching the end)
        this.currentQuoteIndex = (this.currentQuoteIndex + 1) % this.inspirationQuotes.length;
        
        const currentQuote = this.inspirationQuotes[this.currentQuoteIndex];
        
        // Update the inspiration section with animation
        const inspirationDiv = document.getElementById('inspiration');
        if (inspirationDiv) {
            // Add fade-out effect
            inspirationDiv.style.opacity = '0.5';
            inspirationDiv.style.transform = 'translateY(-5px)';
            
            setTimeout(() => {
                inspirationDiv.innerHTML = `
                    <h3>💡 ${currentQuote.title}</h3>
                    <p>${currentQuote.text}</p>
                `;
                
                // Add fade-in effect
                inspirationDiv.style.opacity = '1';
                inspirationDiv.style.transform = 'translateY(0)';
            }, 300);
        }
        
        console.log(`TodoPWA: Showing quote ${this.currentQuoteIndex + 1} of ${this.inspirationQuotes.length}`);
    }

    // Load cached inspiration data
    loadCachedInspirationData() {
        const cached = localStorage.getItem('inspirationQuotes');
        if (cached) {
            this.inspirationQuotes = JSON.parse(cached);
            this.displayInspirationQuote();
        } else {
            // Enhanced English fallback quotes
            this.inspirationQuotes = [
                { 
                    id: 1, 
                    title: "Productivity Wisdom", 
                    text: "Every task completed is a step towards your goals. Small consistent actions lead to extraordinary results." 
                },
                { 
                    id: 2, 
                    title: "Success Mindset", 
                    text: "Progress, not perfection, is the key to success. Focus on moving forward, one task at a time." 
                },
                { 
                    id: 3, 
                    title: "Daily Motivation", 
                    text: "Small steps daily lead to big changes yearly. Your todo list is a roadmap to your dreams." 
                },
                { 
                    id: 4, 
                    title: "Achievement Quote", 
                    text: "The secret to getting ahead is getting started. Every completed task builds momentum for the next." 
                },
                { 
                    id: 5, 
                    title: "Time Management", 
                    text: "You don't have to be great to get started, but you have to get started to be great." 
                },
                { 
                    id: 6, 
                    title: "Focus Power", 
                    text: "Concentration is the secret of strength. Focus on one task at a time and watch your productivity soar." 
                },
                { 
                    id: 7, 
                    title: "Goal Achievement", 
                    text: "A goal without a plan is just a wish. Your todo list transforms wishes into achievable steps." 
                }
            ];
            this.displayInspirationQuote();
        }
    }

    // Generate motivational quotes from post titles
    generateMotivationalQuote(title) {
        const motivationalTemplates = [
            `"${title}" - Remember, every great achievement starts with the decision to try.`,
            `"${title}" - Success is the sum of small efforts repeated day in and day out.`,
            `"${title}" - The way to get started is to quit talking and begin doing.`,
            `"${title}" - Don't watch the clock; do what it does. Keep going.`,
            `"${title}" - The future depends on what you do today.`
        ];
        
        const randomTemplate = motivationalTemplates[Math.floor(Math.random() * motivationalTemplates.length)];
        return randomTemplate;
    }

    // Display random inspiration quote
    displayInspirationQuote() {
        if (this.inspirationQuotes.length === 0) return;
        
        // Start with the first quote or continue from current index
        const currentQuote = this.inspirationQuotes[this.currentQuoteIndex];
        
        // Create or update inspiration section
        let inspirationDiv = document.getElementById('inspiration');
        if (!inspirationDiv) {
            inspirationDiv = document.createElement('div');
            inspirationDiv.id = 'inspiration';
            inspirationDiv.className = 'inspiration-quote';
            inspirationDiv.style.transition = 'all 0.3s ease';
            document.querySelector('.container').appendChild(inspirationDiv);
        }
        
        inspirationDiv.innerHTML = `
            <h3>💡 ${currentQuote.title}</h3>
            <p>${currentQuote.text}</p>
            <div class="quote-progress">
                <div class="quote-dots">
                    ${this.inspirationQuotes.map((_, index) => 
                        `<span class="dot ${index === this.currentQuoteIndex ? 'active' : ''}" onclick="window.app.jumpToQuote(${index})"></span>`
                    ).join('')}
                </div>
                <div class="quote-counter">${this.currentQuoteIndex + 1} / ${this.inspirationQuotes.length}</div>
            </div>
        `;
        
        // Cache the quotes
        localStorage.setItem('inspirationQuotes', JSON.stringify(this.inspirationQuotes));
    }

    // Jump to specific quote
    jumpToQuote(index) {
        if (index >= 0 && index < this.inspirationQuotes.length) {
            this.currentQuoteIndex = index;
            this.showNextQuote();
            // Restart the timer
            this.startQuoteRotation();
        }
    }

    // Save todos to localStorage
    saveTodos() {
        localStorage.setItem('todos', JSON.stringify(this.todos));
    }

    // Render todos list
    renderTodos() {
        const todoList = document.getElementById('todoList');
        if (!todoList) {
            console.error('todoList element not found');
            return;
        }
        
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
                <button class="delete-btn" onclick="window.app && window.app.deleteTodo(${index})">🗑️</button>
            `;
            todoList.appendChild(li);
        });
    }

    // Add new todo
    addTodo() {
        console.log('TodoPWA: addTodo called');
        const input = document.getElementById('todoInput');
        if (!input) {
            console.error('todoInput element not found');
            return;
        }
        
        const todoText = input.value.trim();
        console.log('TodoPWA: Todo text:', todoText);
        
        if (todoText) {
            this.todos.push(todoText);
            console.log('TodoPWA: Updated todos:', this.todos);
            this.saveTodos();
            this.renderTodos();
            input.value = '';
            this.showToast('Task added successfully!', 'success');
            
            // Refresh inspiration quote occasionally
            if (Math.random() < 0.3) {
                this.displayInspirationQuote();
            }
        } else {
            this.showToast('Please enter a task!', 'warning');
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
            "Time to get things done! 🎯",
            "Another productive day starts now! 🌟",
            "Transform your goals into actions! 📋",
            "Success begins with organization! 🎯",
            "Make today count - one task at a time! ⚡"
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

// Global app reference for onclick handlers
let app;

// Global functions for backward compatibility
function addTodo() {
    console.log('Global addTodo called');
    if (window.app && typeof window.app.addTodo === 'function') {
        console.log('Calling app.addTodo()');
        window.app.addTodo();
    } else {
        console.error('App not initialized yet or addTodo method not available');
        console.log('window.app:', window.app);
        // Try to add todo directly if app is not ready
        const input = document.getElementById('todoInput');
        if (input && input.value.trim()) {
            console.log('Adding todo directly to localStorage');
            const todos = JSON.parse(localStorage.getItem('todos') || '[]');
            todos.push(input.value.trim());
            localStorage.setItem('todos', JSON.stringify(todos));
            input.value = '';
            // Refresh page to show updated todos
            setTimeout(() => location.reload(), 100);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    app = new TodoPWA();
    window.app = app;
    console.log('App initialized:', app);
});