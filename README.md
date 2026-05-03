# PBL-8: Automated Blue-Green Deployment (Jenkins + Kubernetes + Docker)

A production-grade blue-green deployment lab built around a polished Flask
"CloudOps" demo app. Two identical Kubernetes Deployments (`app-blue` and
`app-green`) run side-by-side. A single `Service` selector decides which color
serves public traffic. Cutover and rollback are one `kubectl patch`.

```
                  ┌────────────────────────────┐
   user ────────► │  myapp-service (NodePort)  │
                  │  selector: version=blue ◄──┘ patched to "green" on cutover
                  └────────┬────────┬──────────┘
                           ▼        ▼
                ┌──────────────┐  ┌──────────────┐
                │  app-blue    │  │  app-green   │
                │  v=blue      │  │  v=green     │
                └──────────────┘  └──────────────┘
```

## Repository Layout

```
PBL-8-BlueGreen-Deployment/
├── app.py                 # Flask app — reads DEPLOYMENT_VERSION env var
├── templates/
│   ├── base.html          # Bootstrap 5 dark theme + live polling badge
│   ├── index.html         # Home (hero + feature cards)
│   ├── products.html      # Storefront grid
│   └── contact.html       # Contact form
├── requirements.txt
├── Dockerfile
├── k8s/
│   ├── deployment-blue.yaml
│   ├── deployment-green.yaml
│   └── service.yaml       # selector flips between blue/green
├── Jenkinsfile            # Windows-friendly bat/powershell stages
├── rollback.bat           # Manual one-shot rollback
└── README.md
```

## Application Highlights

- 3 pages (Home / Products / Contact), Bootstrap 5 dark theme, gradient background.
- Background color changes blue↔green based on `DEPLOYMENT_VERSION` env var.
- Animated "LIVE: BLUE/GREEN" badge in the navbar.
- JavaScript polls `/version` every 2s — the badge flips in **real time**
  the moment Jenkins switches traffic, with no manual refresh.
- `/version` JSON API returns `{"version":"blue|green","build":"#","host":"pod"}`.
- `/healthz` endpoint backs Kubernetes readiness/liveness probes.

---

## Step-by-Step Instructions (Windows 11, after Lab 7)

You already have: Docker Desktop with Kubernetes enabled, Jenkins running,
GitHub repo, Docker Hub account, and the Jenkins credentials `dockerhub-creds`.
**This guide only covers what's new for blue-green.**

### 1. Push these files to GitHub
```bat
cd D:\DevOps(11152)\PBL3\PBL-8-BlueGreen-Deployment
git add .
git commit -m "Lab 8: blue-green deployment"
git push origin main
```

### 2. Edit one line in the Jenkinsfile
Open `Jenkinsfile` and set your Docker Hub username:
```groovy
DOCKERHUB_USER = 'your-dockerhub-username'
```

### 3. Verify Kubernetes is reachable from Jenkins
On the Jenkins controller (Windows), open a terminal as the Jenkins user and run:
```bat
kubectl get nodes
```
If this works, Jenkins can deploy. If not, copy `%USERPROFILE%\.kube\config`
to the Jenkins service account's home directory.

### 4. Create a new Jenkins Pipeline job
1. Jenkins → **New Item** → name `pbl8-bluegreen` → **Pipeline** → OK.
2. Under **Pipeline**:
   - Definition: *Pipeline script from SCM*
   - SCM: *Git*, URL: your repo
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`
3. Save.

### 5. First run (bootstraps blue + service)
Click **Build with Parameters** → leave `ROLLBACK` unchecked → **Build**.

What happens automatically:
1. Build Docker image tagged `BUILD_NUMBER`.
2. Push to Docker Hub.
3. Apply `app-blue` + `myapp-service` (first run only — selector starts at blue).
4. Apply `app-green` with the new image.
5. Smoke-test green via `kubectl port-forward` and `Invoke-RestMethod /version`.
6. **Patch service selector** `version: blue → green`. ← zero-downtime cutover.
7. Verify `http://localhost:30008/version` returns `green`.

Open `http://localhost:30008` — you'll see the **green** banner go live.

### 6. Verify zero downtime
In one terminal:
```bat
kubectl get pods -w
```
In another, run a continuous probe **during** the pipeline switch:
```powershell
while ($true) {
  try { (Invoke-RestMethod http://localhost:30008/version).version }
  catch { "ERR" }
  Start-Sleep -Milliseconds 300
}
```
You'll see a clean `blue blue blue green green green` — **no errors, no gap**.

Bonus: leave the homepage open in a browser. The badge polls `/version` every
2 seconds, so it animates from BLUE to GREEN automatically when Jenkins flips
the selector — without you refreshing.

### 7. Manual rollback (instant)
The blue deployment is kept warm. To roll back:
```bat
rollback.bat
```
…or run the Jenkins job again with the **`ROLLBACK`** checkbox ticked.

### 8. Simulate a failed green deploy
Edit `Jenkinsfile`, change the image build to a broken tag (e.g. add
`RUN exit 1` to the Dockerfile), and rebuild. The smoke-test stage will fail,
the `post { failure }` block fires, and traffic is auto-patched back to blue.
Public users never noticed.

---

## Useful Commands

```bat
REM See which color is live right now
kubectl get svc myapp-service -o jsonpath="{.spec.selector.version}"

REM Watch pods of both colors
kubectl get pods -l app=myapp -L version -w

REM Hit the public service
curl http://localhost:30008/version
```

## What This Demonstrates

| Capability        | How                                                              |
|-------------------|------------------------------------------------------------------|
| Zero downtime     | Old color keeps serving until the selector patch is acknowledged |
| Instant rollback  | Old color is still running; one patch flips traffic back         |
| Automated tests   | Smoke test against green via port-forward before cutover         |
| Auto-rollback     | `post { failure }` patches selector back to blue                 |
| Real-time visual  | JS polls `/version` every 2s — badge flips live in browser       |
