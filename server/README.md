# 🚀 Allround Server Service

This directory contains the primary Express.js API backend for the Allround application. 

It is designed using a robust modular architecture, integrating deeply with Docker, PostgreSQL, Prisma, Redis, and Socket.io.

## 🏗 Key Features & Architecture

### 1. Robust Modular API Design
We adhere to a strict modular architectural pattern. Each entity in the system is fully self-contained inside `src/app/modules/<module_name>`, featuring:
- **Controllers** (`*.controllers.ts`)
- **Services** (`*.services.ts`)
- **Middlewares** (`*.middlewares.ts`)
- **Routes** (`*.routes.ts`)
- **Schemas & DTOs** (`*.schema.ts`, `*.dto.ts`)
- **Helpers & Types** (`*.helpers.ts`, `*.types.ts`)

This ensures complete separation of concerns and extreme scalability.

### 2. Full Developer Automation
You **never** need to manually wire up Express routes or build boilerplate files. We have custom scripts available at the root of the project that do everything for you automatically:

- **`npm run create:module <name>`**: Scaffolds all 8 module files instantly, injects boilerplate `express` router code, and interactively auto-registers the route into your desired API version.
- **`npm run create:endpoint`**: Interactively prompts for a controller name, route path, method, and status code, and automatically generates the perfectly typed Controller, Service, and Route in the target module.
- **`npm run create:version <v2>`**: Initializes a completely new API version. It automatically creates the directory, wires it up to Express in `app.ts`, and registers the global `baseUrl` mapping in `const.ts`.
- **`npm run add:route <names...>`**: Batch registers existing modules into an API version (e.g. migrating routes to `v2`).
- **`npm run remove:route <names...>`**: Safely rips out route registrations from an API version.

### 3. Native Docker Hot-Reloading
The `server` is natively deeply integrated with Docker Compose.
When you run `docker compose up -d`, the `server` container mounts your local host `./server` directory into `/app`. 

This completely eliminates the need to run `npm start` locally. Simply edit files in VS Code, and `nodemon` running inside the Docker container will instantly hot-reload the application!

### 4. Flawless Prisma & IDE Integration
The project utilizes a monorepo-style shared database model at the root directory. To solve the infamous `TS2305: Module '@prisma/client' has no exported member` issue inside IDEs:

Our `npm run prisma:generate` script is custom-engineered to automatically copy the generated Prisma binaries into the `server/node_modules/` directory every single time the database schema changes, ensuring your VS Code TypeScript server never complains about missing types!

### 5. Socket.io Ready
The `server` comes pre-configured with a powerful Socket.io engine for real-time bidirectional communication, featuring advanced JWT middleware validations (`src/app/middlewares/socket.middlewares.ts`) mapped strictly to your Prisma `user` models. *(Note: Initialization is temporarily disabled while socket module migrations are finalized).*

## 🛠 Quick Commands

> **Important:** These commands must be run from the **root** of the monorepo, not inside the `server/` directory!

```bash
# Start the entire infrastructure (including the server)
docker compose up -d

# View the server logs in real-time
docker logs -f allround-server-server

# Scaffold a new API module
npm run create:module

# Migrate the database and instantly sync types to the server container
npm run prisma:migrate
npm run prisma:sync
```
