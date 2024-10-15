# Baja E-Commerce Project


## Prerequisites

Before you begin, ensure you have the following tools installed on your machine:

- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/products/docker-desktop)
- [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/)

## Step 1: Collaboration Guidelines

We will use two repositories for this project:
- **Frontend**: [`bajaecom-frontend`](https://github.com/WesternBajaRacing/BajaEcom-Frontend)
- **Backend**: [`bajaecom-backend`](https://github.com/WesternBajaRacing/BajaEcom-Backend)


When contributing to the project, please follow these steps:

### 1.1 Fork the repositories:
Each team member should first **fork** the repository by navigating to the repository page on GitHub and clicking the "Fork" button in the top right. This will create a copy of the repository under your own GitHub account. Make sure you deselect the checkbox that say "Only fork 'main' branch". Make sure you fork both frontend and backend.

### 1.2 Clone your forks:
Once you've forked the repository, clone your copy to your local machine,
I would recommend having a folder titled "bajaecom" that has both the frontend and backend cloned inside. This allows you to seamlessly transition between the two during development.
You can clone like this:
```bash
cd /PATH/TO/YOUR/PROJECTS/
mkdir bajaecom
cd bajaecom
git clone https://github.com/<your-username>/bajaecom-backend.git
git clone https://github.com/<your-username>/bajaecom-frontend.git
```

### 1.3 Opening the Repos
Open the cloned repos in your prefered code editor, and make sure you are in the right branch by running the following command in your terminal:
```git checkout dev```

### 1.4 Sync with Upstream Repo
add the original repository as an upstream remote
- backend: ```git remote add upstream https://github.com/WesternBajaRacing/BajaEcom-Backend.git```
- frontend: ```git remote add upstream https://github.com/WesternBajaRacing/BajaEcom-Frontend.git```
this allows your forked repository to stay in sync with the original repository (upstream repository).

### 1.5 Create Feature Branch
once in the 'dev' branch, run this command to build a new feature branch:
```bash
git checkout -b feature-<enter-branch-name-here>
```
an example of a branch name would be "feature-members-view". You can now start developing, once you are done, commit and push your changes to origin.

### 1.6 Merge Feature Branch with Dev
Switch back to the dev branch:
```bash
git checkout dev
```
Merge your feature branch:
```bash
git merge feature-<your-feature-name>
```
Then you can push the updated dev branch

### 1.7 Submit a Pull Request
finally, you can submit a pr:
- Go to your forked repository on GitHub.
- Click on the Pull Requests tab.
- Click the New pull request button.
- Select your fork's dev branch as the compare branch and the original repository's dev branch as the base branch.
- Review your changes and submit the pull request with a descriptive title and message.

## Step 2: Setting Up Backend
Ensure that your terminal is in bajaecom-backend
```bash
cd /PATH/TO/YOUR/PROJECTS/bajaecom-backend
```
### 2.1 Create a '.env' folder
A dot env folder is used to store sensitive information, in this case, it holds the credentials to the postgres database.
Here is an example of how your .env file should look like:
```
# Database Configuration
DB_USER={USERNAME}
DB_PASSWORD={PASSWORD}
DB_HOST=db
DB_PORT={DBPORT}
DB_NAME={DBNAME}

# Server Configuration
PORT={SERVERPORT}
```

### 2.2 Run Backend With Docker
You will have to run the backend with docker by running this command in your terminal.
```docker-compose up --build```

This will start both the PostgreSQL database and the backend server.

The backend API will now be running on http://localhost:13000 (based on the Docker ports configuration).

## Step 3: Set Up Frontend
Navigate to frontend from terminal
```bash
cd /PATH/TO/YOUR/PROJECTS/bajaecom-frontend
```
### 3.1 Install Dependencies 
run the following command to install all dependencies
```npm install```

### 3.2 Run Frontend
To start the frontend development server, run:
```npm start```
The frontend will now be available at http://localhost:3000.
