# 🐳 Docker Deployment Guide

This guide explains how to run the **Smart Documentation System** using Docker and Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed on your machine.
- [Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop).

## Configuration

Before running the containers, you must set up your environment variables.

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Also ensure you have `.env` files in `backend/` and `frontend/` if you want them isolated, or just use the root `.env` as guided in `docker-compose.yml`.
3. Update the values in `.env` with your Supabase credentials and API keys.

> [!IMPORTANT]
> For **BYOK_MASTER_KEY**, if you don't have one, run the generation script locally first:
> ```bash
> cd backend
> python generate_master_key.py
> ```
> Then paste the output into your `.env` file.

## Running the Application

### 🚀 Quick Start (Development Mode)

To start both the frontend and backend with hot-reload support:

```bash
docker-compose up --build
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Swagger Docs**: [http://localhost:8000/swagger](http://localhost:8000/swagger)

### 🛑 Stopping the Application

```bash
docker-compose down
```

## Production Considerations

For production use, you might want to:

1. **Remove volume mappings**: In `docker-compose.yml`, remove the `volumes` section for the backend if you don't want local changes to sync into the container.
2. **Environment Variables**: Use a secure secret management system instead of `.env` files.
3. **Database**: The system uses Supabase (managed service), so ensure your network allows outgoing connections to Supabase.

## Troubleshooting

### Volume Sync Issues
If you see errors related to `venv` or `node_modules`, ensure you are not accidentally overwriting the container's version with your local Windows/Mac version via volumes. The provided `docker-compose.yml` uses anonymous volumes to prevent this:
```yaml
volumes:
  - /app/venv
```

### Port Conflicts
If port `8000` or `5173` is already in use, change the mapping in `docker-compose.yml`:
```yaml
ports:
  - "9000:8000" # Change host port to 9000
```
