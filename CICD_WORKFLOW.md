# CI/CD Pipeline Workflow

## Overview
This document outlines the Continuous Integration and Continuous Deployment (CI/CD) workflow for the API Builder SaaS Application. The workflow ensures that every code change is validated, tested, built into Docker images, and safely deployed to the production Kubernetes/Docker Swarm cluster.

## 1. Continuous Integration (CI)
The CI pipeline triggers automatically on every push to `main` and on all Pull Requests.

### Steps:
1. **Linting & Code Quality:**
   - Runs `eslint` and `prettier` on the Next.js frontend.
   - Runs `go fmt` and `golangci-lint` on the Go API Gateway.
2. **Unit Testing:**
   - Executes Jest tests for React components.
   - Executes `go test -v ./...` for backend gateway and sandbox execution logic.
3. **Build Validation:**
   - Compiles the Next.js frontend to ensure no build errors (`npm run build`).
   - Builds the Go binary to ensure successful compilation.
4. **Security Scanning (Shift-Left):**
   - Scans dependencies for vulnerabilities using `npm audit` and `govulncheck`.
   - Scans Dockerfiles for security best practices using `trivy`.

## 2. Continuous Delivery / Deployment (CD)
The CD pipeline triggers exclusively when a Pull Request is merged into the `main` branch.

### Steps:
1. **Build Docker Images:**
   - Builds the highly-optimized `frontend` (Next.js) Docker image.
   - Builds the minimal `gateway` (Go) Docker image.
2. **Push to Container Registry:**
   - Tags images with the Git commit SHA (e.g., `registry.example.com/api-builder/frontend:a1b2c3d`).
   - Pushes images to a secure private container registry (e.g., GitHub Packages, AWS ECR, or Docker Hub).
3. **Infrastructure Update (GitOps):**
   - Updates the Kubernetes manifests or Docker Swarm stack files with the new image tags.
   - Applies the configuration to the cluster orchestrator.
4. **Zero-Downtime Rolling Update:**
   - The orchestrator gracefully shuts down old containers and replaces them with new ones.
   - Health checks ensure the new Gateway and Frontend containers are accepting traffic before completing the rollout.
5. **Post-Deployment Verification:**
   - Runs automated API integration tests against the live staging/production environment to validate system integrity.
   - If tests fail, automatically rolls back to the previous stable image tag.

## 3. Technology Stack for CI/CD
- **Pipeline Runner:** GitHub Actions (or GitLab CI).
- **Registry:** GitHub Container Registry (ghcr.io).
- **Deployment:** Docker Swarm (`docker stack deploy`) or Kubernetes (ArgoCD / Flux for GitOps).
