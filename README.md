# PBL-8: Automated Blue-Green Deployment with Jenkins, Kubernetes, Docker

Zero-downtime release strategy: two identical environments (**blue** and **green**) run side-by-side; a Service selector switch flips production traffic atomically. Failed releases roll back instantly.

## How Blue-Green Works Here

```
                       ┌─────────────────┐
                       │  pbl8-app-svc   │  (NodePort 30080 — PUBLIC)
                       │ selector: blue  │ ◄─── live users
                       └────────┬────────┘
                                │
            ┌───────────────────┼───────────────────┐
            ▼                                       ▼
   ┌─────────────────┐                    ┌─────────────────┐
   │ Deployment BLUE │                    │ Deployment GREEN│
   │   v1, 3 pods    │                    │   v2, 3 pods    │
   │   ACTIVE        │                    │   IDLE / NEW    │
   └─────────────────┘                    └────────┬────────┘
                                                   ▲
                                          ┌────────┴────────┐
                                          │pbl8-app-preview │ (30081 — QA only)
                                          │ selector: green │
                                          └─────────────────┘
```

**Cutover** = one `kubectl patch` on the public Service selector (`blue` → `green`).
**Rollback** = patch back to `blue` (under 1 second; old pods are still running).

## Repository Layout

```
PBL-8-BlueGreen-Deployment/
├── app/                       # Flask app — reads APP_COLOR / APP_VERSION env vars
├── Dockerfile
├── k8s/
│   ├── deployment-blue.yaml   # Blue env (3 replicas, color=blue)
│   ├── deployment-green.yaml  # Green env (3 replicas, color=green)
│   ├── service.yaml           # Public service — selector flips on cutover
│   └── service-preview.yaml   # Preview service for the inactive color
├── scripts/
│   ├── switch-traffic.sh      # Atomic blue ↔ green flip
│   └── rollback.sh            # Auto-detect current color & flip back
├── Jenkinsfile                # Build → deploy idle → smoke → approval → cut over
└── README.md
```

## Prerequisites

| Tool | Purpose |
|------|---------|
| Jenkins LTS | Pipeline orchestration |
| Docker | Image build/push |
| Kubernetes 1.27+ | Runtime |
| kubectl | Cluster control |

Jenkins credentials needed: `dockerhub-creds`, `kubeconfig`.

## Manual Walk-through (without Jenkins)

```bash
# 1. Bootstrap blue (initial release)
docker build -t yourid/pbl8-app:v1 .
docker push yourid/pbl8-app:v1
sed "s|REPLACE_ME_IMAGE|yourid/pbl8-app:v1|" k8s/deployment-blue.yaml | kubectl apply -f -
kubectl apply -f k8s/service.yaml          # selector: blue
kubectl apply -f k8s/service-preview.yaml

# 2. Deploy green (new release, idle)
docker build -t yourid/pbl8-app:v2 .
docker push yourid/pbl8-app:v2
sed "s|REPLACE_ME_IMAGE|yourid/pbl8-app:v2|" k8s/deployment-green.yaml | kubectl apply -f -

# 3. Test green via preview
curl http://<node-ip>:30081/

# 4. Cut over
bash scripts/switch-traffic.sh green

# 5. Roll back if needed
bash scripts/rollback.sh
```

## Pipeline Flow (Jenkinsfile)

| Stage                      | Action                                                          |
|----------------------------|-----------------------------------------------------------------|
| Checkout                   | Pull source                                                     |
| Build & Push Image         | `docker build/push` with new tag                                |
| Deploy to Inactive Color   | Apply `deployment-${TARGET_COLOR}.yaml` (TARGET_COLOR is param) |
| Smoke Test (Preview)       | Patch preview svc → curl `/health`                              |
| Manual Approval            | Human gate — verify preview before cutover                      |
| Cut Over Traffic           | `switch-traffic.sh ${TARGET_COLOR}` patches public svc          |
| Post-Cutover Verification  | Hit live svc 5x to confirm new version serves                   |
| `post.failure` → Rollback  | `rollback.sh` flips selector back automatically                 |

Pipeline parameters:
- `TARGET_COLOR` — which env to deploy to (must be the *inactive* one)
- `IMAGE_TAG` — version tag pushed and rolled out

## Verifying the Switch

```bash
# Watch which color is live
watch "kubectl get svc pbl8-app-svc -o jsonpath='{.spec.selector.color}'"

# Confirm user-visible version
curl http://<node-ip>:30080/   # → reports color + version
```

## Outcome

- **Zero downtime** during deploys (old pods keep serving until the patch).
- **Instant rollback** (no rebuild, no re-pull — old color is still warm).
- **Pre-cutover validation** via dedicated preview service.
- **Automated** end-to-end via Jenkins with a human approval gate.
