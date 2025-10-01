# Backend — NestJS + MongoDB

API para autenticación, proyectos, eventos, generación de dataLayer, integraciones (stubs) y verificación (stub).

## Desarrollo
```bash
npm install
npm run start:dev
```

Docs Swagger: http://localhost:4000/docs

## Env
Copiar `.env.example` a `.env` y ajustar valores.

## Endpoints principales (resumen)
- POST /auth/register, POST /auth/login, POST /auth/refresh, POST /auth/logout
- POST /auth/api-tokens, DELETE /auth/api-tokens/:id
- GET/POST/PUT/DELETE /projects
- GET/POST/PUT/DELETE /events
- POST /measurement/plan/generate
- GET /measurement/datalayer?projectId=...&format=json|js
- GET /measurement/datalayer/download?projectId=...&format=json|js
- POST /integrations/gtm/connect, POST /integrations/ga4/connect
- GET /integrations/gtm/containers, POST /integrations/gtm/export
- POST /verification/run, GET /verification/:runId
