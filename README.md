# Be My GPT 🤖

"Be My GPT" is an interactive web-based game designed to teach students and beginners the fundamental concepts behind how Large Language Models (LLMs) like GPT are created and how they perform inference.

Instead of just reading about AI, users actively participate in each step of a simplified model-building process: defining a vocabulary, creating a training dataset, writing a prompt, and finally, acting as the "GPT" to generate a response. The game then scores the user's response based on how well it adheres to the patterns learned from the training data.

This hands-on approach demystifies the magic of AI, breaking it down into understandable, statistical steps.

## Features

-   **Step-by-Step Guided Process:** A wizard-like interface walks users through the four key stages.
-   **Interactive Vocabulary Building:** Users can create their own token vocabulary or start with a pre-defined set of ~200 common English tokens.
-   **Custom Training Data:** Users supply their own training phrases, which the "model" (the user) will learn from. A starter set of phrases is also available.
-   **User-as-Inference-Engine:** The core of the game! Users must generate a response to a prompt using only the allowed vocabulary and the statistical patterns they can observe from the training data.
-   **Heuristic Scoring:** A scoring system analyzes the user's response, awarding points for using valid tokens and for creating word pairs (n-grams) that appeared in the training set.
-   **Embedded Education:** Info boxes explain the analogy to real-world models like GPT-2 and GPT-4o, with links to real vocabulary sets.
-   **Data Persistence:** Game state is saved per session, allowing users to pick up where they left off.
-   **Dockerized Deployment:** The entire application is containerized for easy and consistent deployment.

## How to Run the Project

You can run this project either locally for development or as a containerized application using Docker.

### Running with Docker (Recommended)

Using Docker is the easiest and most reliable way to run "Be My GPT". It ensures the environment is identical for everyone.

**Prerequisites:**
-   [Docker Desktop](https://www.docker.com/get-started/) installed and running on your system.

**Steps:**

1.  **Clone the Repository:**
    ```bash
    git clone <your-repo-url>
    cd be-my-gpt
    ```

2.  **Build and Run with Docker Compose:**
    Open a terminal in the project's root directory and run the following command:
    ```bash
    docker-compose up --build
    ```
    -   `--build`: This flag tells Docker to build the image from the `Dockerfile` the first time you run it. You can omit this flag on subsequent runs.
    -   Docker will now build the image, install all dependencies, compile the TypeScript code, and start the application.

3.  **Access the Game:**
    Once the container is running, you will see log output in your terminal. You can now access the game by opening your web browser and navigating to:
    **[http://localhost:3333](http://localhost:3333)**

4.  **Stopping the Application:**
    To stop the application, return to your terminal and press `Ctrl+C`. To remove the container, you can run:
    ```bash
    docker-compose down
    ```
    *(Note: Your database data will be preserved in a Docker volume and will be available the next time you run `docker-compose up`.)*

### Local Development (Without Docker)

If you prefer to run the project directly on your machine for development.

**Prerequisites:**
-   [Node.js](https://nodejs.org/) (v18 or later)
-   npm (usually comes with Node.js)

**Steps:**

1.  **Clone the Repository:**
    ```bash
    git clone <your-repo-url>
    cd be-my-gpt
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Run the Development Server:**
    This command uses `nodemon` to automatically restart the server when you make changes to the source code.
    ```bash
    npm start
    ```

4.  **Access the Game:**
    The server will be running on `http://localhost:3333`.

## Technology Stack

-   **Backend:** Node.js with Express.js (TypeScript)
-   **Frontend:** Plain HTML, CSS, and JavaScript (no framework)
-   **Database:** SQLite (via `better-sqlite3` for synchronous access)
-   **Containerization:** Docker & Docker Compose

---