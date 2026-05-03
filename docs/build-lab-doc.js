const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, PageNumber, PageBreak,
} = require('docx');

const FONT = "Calibri";
const PAGE_W = 12240;
const PAGE_H = 15840;
const MARGIN = 1440;
const CONTENT_W = PAGE_W - MARGIN * 2;

const border = { style: BorderStyle.SINGLE, size: 4, color: "B0B0B0" };
const cellBorders = { top: border, bottom: border, left: border, right: border };
const cellMargin = { top: 100, bottom: 100, left: 140, right: 140 };

function p(text, opts = {}) {
  const { bold, italic, size, color, align, spacingBefore, spacingAfter } = opts;
  return new Paragraph({
    alignment: align,
    spacing: { before: spacingBefore ?? 80, after: spacingAfter ?? 80 },
    children: [new TextRun({ text, bold, italics: italic, size, color, font: FONT })],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, size: 32, color: "1F3864", font: FONT })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: "2E75B6", font: FONT })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: FONT })],
  });
}

function code(text) {
  const lines = text.split('\n');
  return lines.map((line, i) => new Paragraph({
    spacing: { before: i === 0 ? 100 : 0, after: i === lines.length - 1 ? 120 : 0, line: 260 },
    shading: { fill: "F2F2F2", type: ShadingType.CLEAR },
    indent: { left: 200, right: 200 },
    children: [new TextRun({ text: line || " ", font: "Consolas", size: 20, color: "1A1A1A" })],
  }));
}

function ssPlaceholder(num, caption) {
  return [
    new Paragraph({
      spacing: { before: 200, after: 60 },
      alignment: AlignmentType.CENTER,
      shading: { fill: "FFF2CC", type: ShadingType.CLEAR },
      border: {
        top:    { style: BorderStyle.DASHED, size: 8, color: "BF8F00", space: 4 },
        bottom: { style: BorderStyle.DASHED, size: 8, color: "BF8F00", space: 4 },
        left:   { style: BorderStyle.DASHED, size: 8, color: "BF8F00", space: 4 },
        right:  { style: BorderStyle.DASHED, size: 8, color: "BF8F00", space: 4 },
      },
      children: [new TextRun({ text: `[ Screenshot ${num} placeholder ]`, bold: true, size: 22, color: "BF8F00", font: FONT })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Figure ${num}: ${caption}`, italics: true, size: 20, color: "595959", font: FONT })],
    }),
  ];
}

function tableRow(cells, header = false) {
  return new TableRow({
    tableHeader: header,
    children: cells.map(c => new TableCell({
      borders: cellBorders,
      margins: cellMargin,
      width: { size: c.w, type: WidthType.DXA },
      shading: header ? { fill: "1F3864", type: ShadingType.CLEAR } : undefined,
      children: [new Paragraph({
        children: [new TextRun({ text: c.t, bold: header, color: header ? "FFFFFF" : "000000", size: 22, font: FONT })],
      })],
    })),
  });
}

function buildTable(columns, rows) {
  const totalW = columns.reduce((s, w) => s + w, 0);
  const headerRow = tableRow(rows[0].map((t, i) => ({ t, w: columns[i] })), true);
  const dataRows = rows.slice(1).map(r => tableRow(r.map((t, i) => ({ t, w: columns[i] }))));
  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: columns,
    rows: [headerRow, ...dataRows],
  });
}

const titlePage = [
  new Paragraph({
    spacing: { before: 2400, after: 240 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Lab 8", size: 56, bold: true, color: "1F3864", font: FONT })],
  }),
  new Paragraph({
    spacing: { after: 240 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: "Automated Blue-Green Deployment Strategy using Jenkins, Kubernetes, and Docker",
      size: 36, bold: true, color: "2E75B6", font: FONT,
    })],
  }),
  new Paragraph({
    spacing: { after: 1200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: "CloudOps — a multi-page Flask application demonstrating zero-downtime releases",
      size: 26, italics: true, color: "595959", font: FONT,
    })],
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 120 },
    children: [new TextRun({ text: "Submitted by", size: 22, color: "595959", font: FONT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [new TextRun({ text: "Naveen K M", size: 28, bold: true, font: FONT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120 },
    children: [new TextRun({ text: "Repository", size: 22, color: "595959", font: FONT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "https://github.com/naveenkm21/pbl-8-bluegreen", size: 22, color: "0563C1", font: FONT })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

const aim = [
  h1("1. Aim"),
  p("Design and implement an automated blue-green deployment pipeline that releases a new version of a containerized web application to a Kubernetes cluster with zero downtime, supports a one-click rollback, and triggers an automatic rollback when a release fails its smoke tests. The pipeline is orchestrated by Jenkins, the artifact is a Docker image stored on Docker Hub, and the runtime is a local Kubernetes cluster on Windows 11. The strategy is demonstrated end-to-end with a polished Flask application whose UI flips colour the instant the traffic switch occurs."),

  h1("2. Objectives"),
  bullet("Build a visually distinctive multi-page Flask application (CloudOps) whose theme reflects the active deployment colour through an environment variable."),
  bullet("Containerize the application and publish each build to Docker Hub with the Jenkins build number as the image tag."),
  bullet("Author two identical Kubernetes Deployments (app-blue and app-green) and a single Service whose selector decides which colour serves traffic."),
  bullet("Configure a Jenkins declarative pipeline that builds, pushes, deploys the new (green) version, smoke-tests it before any user traffic, then atomically switches the Service selector."),
  bullet("Provide a parameterised rollback path (manual via the ROLLBACK checkbox) and an automatic rollback path (post { failure } block) that flips traffic back to blue without rebuilding."),
  bullet("Demonstrate zero downtime using a continuous in-cluster probe across a live traffic flip — proving zero failed requests during the cutover."),
  bullet("Provide a real-time visual confirmation: a JavaScript poller in the page reads /version every 2 seconds and animates the badge / gradient when the colour changes, with no manual page refresh."),

  h1("3. Tools and Technologies"),
  buildTable(
    [2400, 2200, CONTENT_W - 4600],
    [
      ["Tool", "Version", "Role in the lab"],
      ["Windows 11", "23H2", "Host operating system"],
      ["Docker Desktop", "Latest", "Local container runtime + Kubernetes"],
      ["Kubernetes", "v1.30+", "Workload orchestrator (Docker Desktop K8s)"],
      ["kubectl", "v1.30+", "Kubernetes CLI"],
      ["Python / Flask", "3.12 / 3.0.3", "Web application runtime"],
      ["Bootstrap", "5.3", "Front-end styling (dark theme + animated badge)"],
      ["gunicorn", "22.0", "Production WSGI server"],
      ["Jenkins LTS", "2.555+", "CI/CD orchestrator (running in Docker)"],
      ["Docker Hub", "—", "Public image registry (naveenkm21/cloudops-bluegreen)"],
      ["GitHub", "—", "Source control"],
      ["Git for Windows", "2.47", "Local source control client"],
    ]
  ),

  h1("4. Architecture and Workflow"),
  p("Two identical Deployments run side-by-side: app-blue (label version=blue) and app-green (label version=green). A single Service named myapp-service has a selector that matches one of these labels at a time. Switching production traffic is a single kubectl patch on the Service selector — instant, atomic, and reversible. The Jenkins pipeline builds and pushes a new image, applies the green Deployment with the new image, runs an in-pod smoke test (kubectl exec into the green pod and curl /version) before any real user touches it, then patches the Service selector from blue to green. The previous blue Deployment is left running so a rollback is one patch away. If any stage fails, the post { failure } block patches the selector back to blue automatically."),
  ...ssPlaceholder(1, "End-to-end blue-green pipeline architecture (developer → GitHub → Jenkins → Docker Hub → Kubernetes Service ↔ blue/green Deployments)."),
];

const setup = [
  h1("5. Environment Setup"),
  h2("5.1 Project Structure"),
  ...code(
`PBL-8-BlueGreen-Deployment/
├── app.py                     Flask app (reads DEPLOYMENT_VERSION env var)
├── requirements.txt           Flask + gunicorn
├── Dockerfile
├── templates/
│   ├── base.html              Bootstrap 5, gradient + JS poller
│   ├── index.html             Hero + feature cards
│   ├── products.html          Storefront grid
│   └── contact.html           Contact form
├── k8s/
│   ├── deployment-blue.yaml   2 replicas, version=blue
│   ├── deployment-green.yaml  2 replicas, version=green
│   └── service.yaml           LoadBalancer, selector flips blue↔green
├── Jenkinsfile                Pipeline (Linux sh, parameterised ROLLBACK)
├── rollback.bat               Manual one-shot rollback
└── README.md`),
  ...ssPlaceholder(2, "Project folder layout in VS Code or File Explorer."),

  h2("5.2 Prerequisites Verification"),
  p("All commands below were executed in a fresh PowerShell session to confirm the environment was ready before starting the lab:"),
  ...code(
`docker --version
kubectl get nodes
kubectl config current-context
git --version`),
  ...ssPlaceholder(3, "Output of `kubectl get nodes` showing the Docker Desktop control-plane in Ready state."),
];

const flask = [
  h1("6. The Flask Application — CloudOps"),
  p("CloudOps is a small but visually polished demo application. Each rendered page reads the DEPLOYMENT_VERSION environment variable, which is set differently in the blue and green Deployments. The base template applies a blue or green gradient and shows a pulsating badge in the navbar, so the active colour is immediately obvious. A small piece of JavaScript polls /version every 2 seconds and animates the badge when the value changes — providing a live visual confirmation of a traffic switch with no page refresh."),

  h2("6.1 Routes"),
  buildTable(
    [2200, CONTENT_W - 2200],
    [
      ["Route", "Purpose"],
      ["/", "Hero + feature cards (Zero Downtime, Instant Rollback, Automated)"],
      ["/products", "Storefront grid with six demo products"],
      ["/contact", "Contact form"],
      ["/version", "JSON: {version, build, host} — used by the JS poller and smoke tests"],
      ["/healthz", "JSON liveness/readiness probe used by Kubernetes"],
    ]
  ),
  ...ssPlaceholder(4, "Home page showing the BLUE badge and blue gradient (DEPLOYMENT_VERSION=blue)."),
  ...ssPlaceholder(5, "Home page showing the GREEN badge and green gradient (DEPLOYMENT_VERSION=green)."),

  h2("6.2 Local Run"),
  ...code(
`pip install -r requirements.txt
$env:DEPLOYMENT_VERSION="blue"
python app.py
# Browse to http://localhost:5000`),
];

const docker = [
  h1("7. Containerization"),
  p("A single image is used for both colours; the colour is selected at runtime by the DEPLOYMENT_VERSION environment variable supplied in each Deployment's pod spec. The Dockerfile copies requirements first to maximise the pip-install layer cache."),
  ...code(
`FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
COPY templates/ ./templates/
COPY static/ ./static/
ENV DEPLOYMENT_VERSION=blue
EXPOSE 5000
CMD ["gunicorn", "-b", "0.0.0.0:5000", "-w", "2", "--access-logfile", "-", "app:app"]`),

  h2("7.1 Local Build, Tag, and Push"),
  ...code(
`docker build -t naveenkm21/cloudops-bluegreen:1 -t naveenkm21/cloudops-bluegreen:latest .
docker login -u naveenkm21
docker push naveenkm21/cloudops-bluegreen:1`),
  ...ssPlaceholder(6, "Docker build output ending with `naming to docker.io/naveenkm21/cloudops-bluegreen:1`."),
  ...ssPlaceholder(7, "Docker Hub repository page showing the cloudops-bluegreen image tags."),
];

const k8s = [
  h1("8. Kubernetes Manifests"),
  h2("8.1 Two Deployments, One Service"),
  p("The blue and green Deployments are byte-for-byte identical except for their version label and the value of the DEPLOYMENT_VERSION environment variable. The image field is set to IMAGE_PLACEHOLDER, which Jenkins substitutes via sed at deploy time."),
  ...code(
`# k8s/deployment-blue.yaml (excerpt)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-blue
  labels: { app: myapp, version: blue }
spec:
  replicas: 2
  selector:
    matchLabels: { app: myapp, version: blue }
  template:
    metadata:
      labels: { app: myapp, version: blue }
    spec:
      containers:
        - name: web
          image: IMAGE_PLACEHOLDER
          ports: [{ containerPort: 5000 }]
          env:
            - { name: DEPLOYMENT_VERSION, value: "blue" }
            - { name: BUILD_NUMBER, value: "BUILD_PLACEHOLDER" }
          readinessProbe: { httpGet: { path: /healthz, port: 5000 }, initialDelaySeconds: 3 }
          livenessProbe:  { httpGet: { path: /healthz, port: 5000 }, initialDelaySeconds: 10 }`),
  p("k8s/deployment-green.yaml is identical except for value: green, name: app-green, and the matching labels."),

  h2("8.2 The Service — the Traffic Switch"),
  p("A single Service routes traffic to whichever colour its selector matches. Changing the selector is the cutover. type: LoadBalancer is used because Docker Desktop maps LoadBalancer services directly to localhost, and unlike kubectl port-forward it routes through real kube-proxy and respects selector changes instantly."),
  ...code(
`apiVersion: v1
kind: Service
metadata:
  name: myapp-service
  labels: { app: myapp }
spec:
  type: LoadBalancer
  selector:
    app: myapp
    version: blue        # patched to "green" by Jenkins on cutover
  ports:
    - { name: http, port: 30008, targetPort: 5000, nodePort: 30008 }`),

  h2("8.3 Bootstrap (first deploy of blue)"),
  ...code(
`(Get-Content k8s/deployment-blue.yaml) `+
`-replace 'IMAGE_PLACEHOLDER','naveenkm21/cloudops-bluegreen:1' `+
`-replace 'BUILD_PLACEHOLDER','1' | kubectl apply -f -

kubectl apply -f k8s/service.yaml
kubectl rollout status deployment/app-blue --timeout=120s
kubectl get deploy,svc,pods -l app=myapp`),
  ...ssPlaceholder(8, "kubectl get deploy,svc,pods -l app=myapp showing app-blue (2/2) and the LoadBalancer Service exposed on 30008."),
  ...ssPlaceholder(9, "Browser at http://localhost:30008 — BLUE badge visible (initial state, only blue exists)."),
];

const jenkins = [
  h1("9. Jenkins Setup"),
  p("The Jenkins LTS container from Lab 7 is reused. Three things are required for the blue-green pipeline:"),
  bullet("Docker socket access (so docker build / push works inside the Jenkins container)."),
  bullet("kubectl with a kubeconfig that can reach the host's Kubernetes cluster."),
  bullet("A Username with Password credential called docker-creds (Docker Hub PAT)."),

  h2("9.1 Verifying Tools Inside the Jenkins Container"),
  ...code(
`docker exec jenkins which docker
docker exec jenkins which kubectl
docker exec jenkins docker ps --format '{{.Names}}'
docker exec jenkins kubectl get nodes
docker exec jenkins kubectl get deploy,svc -l app=myapp`),
  ...ssPlaceholder(10, "docker exec jenkins kubectl get nodes — Jenkins can reach the cluster from inside the container."),

  h2("9.2 Pipeline Job Configuration"),
  buildTable(
    [3000, CONTENT_W - 3000],
    [
      ["Field", "Value"],
      ["Job name", "pbl8-bluegreen"],
      ["Type", "Pipeline"],
      ["Definition", "Pipeline script from SCM"],
      ["SCM", "Git"],
      ["Repository URL", "https://github.com/naveenkm21/pbl-8-bluegreen.git"],
      ["Branch Specifier", "*/main"],
      ["Script Path", "Jenkinsfile"],
      ["Parameter", "ROLLBACK (boolean, default false) — discovered from the Jenkinsfile on first run"],
    ]
  ),
  ...ssPlaceholder(11, "Jenkins job configuration page for `pbl8-bluegreen`."),
];

const pipeline = [
  h1("10. The Jenkins Pipeline"),
  p("The Jenkinsfile uses declarative syntax. The single ROLLBACK boolean parameter short-circuits the pipeline: when ticked, only the Rollback Only stage runs (one kubectl patch); when unticked, the full build → push → deploy → smoke → switch flow runs."),
  ...code(
`pipeline {
  agent any
  parameters { booleanParam(name: 'ROLLBACK', defaultValue: false) }
  environment {
    DOCKERHUB_USER = 'naveenkm21'
    IMAGE_NAME     = 'cloudops-bluegreen'
    IMAGE_TAG      = "\${env.BUILD_NUMBER}"
    FULL_IMAGE     = "\${DOCKERHUB_USER}/\${IMAGE_NAME}:\${IMAGE_TAG}"
    SERVICE_NAME   = 'myapp-service'
    NODE_PORT      = '30008'
  }
  stages {
    stage('Rollback Only') {
      when { expression { params.ROLLBACK } }
      steps {
        sh '''
          kubectl patch service \${SERVICE_NAME} \\
            -p '{"spec":{"selector":{"app":"myapp","version":"blue"}}}'
        '''
      }
    }
    stage('Build Docker Image') {
      when { expression { !params.ROLLBACK } }
      steps { sh 'docker build -t \${FULL_IMAGE} .' }
    }
    stage('Push to Docker Hub') {
      when { expression { !params.ROLLBACK } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'docker-creds',
            usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh '''
            echo "\$DH_PASS" | docker login -u "\$DH_USER" --password-stdin
            docker push \${FULL_IMAGE}
          '''
        }
      }
    }
    stage('Ensure Blue + Service Exist') {
      when { expression { !params.ROLLBACK } }
      steps {
        sh '''
          sed -e "s|IMAGE_PLACEHOLDER|\${FULL_IMAGE}|g" \\
              -e "s|BUILD_PLACEHOLDER|\${BUILD_NUMBER}|g" \\
              k8s/deployment-blue.yaml | kubectl apply -f -
          kubectl apply -f k8s/service.yaml
          kubectl rollout status deployment/app-blue --timeout=120s
        '''
      }
    }
    stage('Deploy GREEN (new version)') {
      when { expression { !params.ROLLBACK } }
      steps {
        sh '''
          sed -e "s|IMAGE_PLACEHOLDER|\${FULL_IMAGE}|g" \\
              -e "s|BUILD_PLACEHOLDER|\${BUILD_NUMBER}|g" \\
              k8s/deployment-green.yaml | kubectl apply -f -
          kubectl rollout status deployment/app-green --timeout=180s
        '''
      }
    }
    stage('Smoke Test GREEN') {
      when { expression { !params.ROLLBACK } }
      steps {
        sh '''
          RESULT=\$(kubectl exec deployment/app-green -- python -c \\
            "import urllib.request; print(urllib.request.urlopen('http://localhost:5000/version').read().decode())")
          echo "\$RESULT" | grep -q '"version":"green"' || { echo "Smoke FAILED"; exit 1; }
        '''
      }
    }
    stage('Switch Traffic: BLUE -> GREEN') {
      when { expression { !params.ROLLBACK } }
      steps {
        sh '''
          kubectl patch service \${SERVICE_NAME} \\
            -p '{"spec":{"selector":{"app":"myapp","version":"green"}}}'
        '''
      }
    }
    stage('Post-Switch Verification') {
      when { expression { !params.ROLLBACK } }
      steps {
        sh '''
          sleep 2
          RESULT=\$(kubectl exec deployment/app-green -- python -c \\
            "import urllib.request; print(urllib.request.urlopen('http://\${SERVICE_NAME}.default.svc.cluster.local:\${NODE_PORT}/version').read().decode())")
          echo "\$RESULT" | grep -q '"version":"green"' || { echo "Verify FAILED"; exit 1; }
        '''
      }
    }
  }
  post {
    failure {
      sh 'kubectl patch service \${SERVICE_NAME} \\
            -p \\'{"spec":{"selector":{"app":"myapp","version":"blue"}}}\\' || true'
    }
    success { echo "Build #\${env.BUILD_NUMBER} live. http://localhost:30008" }
  }
}`),

  h2("10.1 Stage Summary"),
  buildTable(
    [3200, CONTENT_W - 3200],
    [
      ["Stage", "Outcome"],
      ["Checkout", "Clones the repository at the latest main commit"],
      ["Rollback Only (when ROLLBACK)", "Patches Service selector back to version=blue and exits"],
      ["Build Docker Image", "Produces naveenkm21/cloudops-bluegreen:<BUILD_NUMBER>"],
      ["Push to Docker Hub", "Authenticates with docker-creds and pushes the new tag"],
      ["Ensure Blue + Service Exist", "Idempotently applies blue Deployment + Service (bootstraps on first run)"],
      ["Deploy GREEN", "Applies green Deployment with the new image; waits for rollout"],
      ["Smoke Test GREEN", "kubectl exec into green pod; verifies /version returns \"green\""],
      ["Switch Traffic: BLUE → GREEN", "Patches Service selector — atomic cutover"],
      ["Post-Switch Verification", "Hits Service from inside the cluster; confirms green serves"],
      ["post { failure }", "Auto-rollback: patches selector back to blue if any stage failed"],
    ]
  ),
];

const exec = [
  h1("11. Pipeline Execution"),
  h2("11.1 First Build (Bootstrap blue + initial green deploy)"),
  p("With the job created and the Jenkinsfile present in the repository, the first Build Now run was triggered. The console output shows all stages green and ends with 'Build #N live. http://localhost:30008'."),
  ...ssPlaceholder(12, "Jenkins Stage View showing all stages green for the first successful blue-green build."),
  ...ssPlaceholder(13, "Console output of the Build Docker Image stage — `naming to docker.io/naveenkm21/cloudops-bluegreen:N done`."),
  ...ssPlaceholder(14, "Console output of the Smoke Test GREEN stage — `{\"version\":\"green\",...}` then `Smoke test PASSED`."),
  ...ssPlaceholder(15, "Console output of the Switch Traffic stage — `service/myapp-service patched`, then `selector: app=myapp,version=green`."),

  h2("11.2 Subsequent Build (Re-deploy)"),
  p("Build with Parameters → ROLLBACK unticked → Build runs the full pipeline again with a new image tag. Within seconds of the Switch Traffic stage finishing, the live application's badge animates from BLUE to GREEN in the browser without any page refresh."),
  ...ssPlaceholder(16, "Browser at http://localhost:30008 immediately BEFORE the cutover — BLUE badge visible."),
  ...ssPlaceholder(17, "Browser at http://localhost:30008 ~2 seconds AFTER the cutover — badge has animated to GREEN, gradient shifted."),

  h2("11.3 Manual Rollback"),
  p("Build with Parameters → ROLLBACK ticked → Build runs only the Rollback Only stage, which patches the Service selector back to version=blue. The browser flips back to BLUE within ~2 seconds."),
  ...ssPlaceholder(18, "Jenkins Build with Parameters page — ROLLBACK checkbox visible and ticked."),
  ...ssPlaceholder(19, "Browser at http://localhost:30008 after manual rollback — BLUE badge restored."),
];

const verify = [
  h1("12. Verification"),
  h2("12.1 Both Colours Always Running"),
  ...code(
`kubectl get deploy -l app=myapp -L version
kubectl get pods   -l app=myapp -L version
kubectl get svc myapp-service -o wide`),
  ...ssPlaceholder(20, "Cluster state — app-blue 2/2 and app-green 2/2 both Running; Service selector currently version=green."),

  h2("12.2 Zero-Downtime Proof (in-cluster probe)"),
  p("To prove that no requests fail during a traffic switch, a continuous in-cluster probe was launched and a manual flip was performed mid-stream:"),
  ...code(
`kubectl run probe --rm -i --restart=Never --image=curlimages/curl --command -- sh -c '
  for i in $(seq 1 80); do
    curl -s -m 1 http://myapp-service.default.svc.cluster.local:30008/version
    echo
    sleep 0.25
  done' &

# After ~7 seconds, in another terminal:
kubectl patch service myapp-service \\
  -p '{"spec":{"selector":{"app":"myapp","version":"blue"}}}'`),
  p("Result observed during the lab: 79 requests sent at 250 ms intervals, 13 served by green, 66 served by blue after the patch, ZERO errors. The selector flip is reflected by kube-proxy iptables within a single request interval."),
  ...ssPlaceholder(21, "Terminal showing the in-cluster probe output — clean blue → green → blue transition, 0 ERR lines."),

  h2("12.3 Auto-Rollback on Failure"),
  p("To trigger the auto-rollback path the /healthz endpoint was temporarily changed to return HTTP 500. After git push the next Jenkins build was triggered. Behaviour observed:"),
  bullet("Build and push succeeded."),
  bullet("Deploy GREEN failed in `kubectl rollout status` because the readiness probe never passed."),
  bullet("`post { failure }` block fired and patched the Service selector back to version=blue."),
  bullet("Public traffic was on blue throughout — no impact to users."),
  ...ssPlaceholder(22, "Console output of a failed build — failed Deploy GREEN stage followed by `post { failure }` patching selector back to blue."),

  h2("12.4 Real-Time UI Switch"),
  p("The base template includes a small JavaScript that fetches /version every 2 seconds and animates the navbar badge and the page background gradient when the value changes. This makes the blue→green or green→blue switch immediately visible to anyone watching the page, without a manual refresh."),
  ...ssPlaceholder(23, "Two browser windows side-by-side at http://localhost:30008 — left BLUE, right GREEN — captured during a Jenkins-triggered flip."),
];

const conclusion = [
  h1("13. Conclusion"),
  p("The blue-green deployment pattern, implemented here with Jenkins, Docker, and Kubernetes, eliminates two of the most painful failure modes of traditional releases: downtime and slow rollback. Two identical environments run side-by-side, the application keeps serving the previous colour while the new colour is deployed and validated, and a single kubectl patch routes user traffic atomically. Because the previous colour stays warm, a rollback costs nothing more than another patch — under one second, no rebuild, no image pull. The automated pipeline ties it all together: the only manual step is a click in Jenkins, and even that is gated by a smoke test that prevents a broken release from ever seeing real traffic. The same pattern transfers verbatim to managed Kubernetes (EKS, GKE, AKS) — only kubeconfig and registry change, the manifests and pipeline stay the same."),

  h1("14. References"),
  bullet("Blue-Green Deployment (Martin Fowler) — https://martinfowler.com/bliki/BlueGreenDeployment.html"),
  bullet("Kubernetes Service documentation — https://kubernetes.io/docs/concepts/services-networking/service/"),
  bullet("Jenkins Declarative Pipeline — https://www.jenkins.io/doc/book/pipeline/syntax/"),
  bullet("Docker documentation — https://docs.docker.com/"),
  bullet("Lab repository — https://github.com/naveenkm21/pbl-8-bluegreen"),

  new Paragraph({ children: [new PageBreak()] }),

  h1("Appendix A — Screenshot Checklist"),
  p("Insert each screenshot in the order below, replacing the corresponding yellow [ Screenshot N placeholder ] block. The italic figure caption beneath each placeholder is the suggested caption text."),
];

const screenshotList = [
  ["1",  "Blue-green pipeline architecture diagram"],
  ["2",  "Project folder layout in VS Code"],
  ["3",  "kubectl get nodes — cluster Ready"],
  ["4",  "Browser — BLUE version of the home page"],
  ["5",  "Browser — GREEN version of the home page"],
  ["6",  "docker build output (image successfully tagged)"],
  ["7",  "Docker Hub repository tags for cloudops-bluegreen"],
  ["8",  "kubectl get deploy/svc/pods after blue bootstrap"],
  ["9",  "Browser at http://localhost:30008 with only blue running"],
  ["10", "kubectl get nodes from inside the Jenkins container"],
  ["11", "Jenkins job configuration page (pbl8-bluegreen)"],
  ["12", "Jenkins Stage View — first full pipeline run successful"],
  ["13", "Console output: Build Docker Image stage"],
  ["14", "Console output: Smoke Test GREEN stage (Smoke test PASSED)"],
  ["15", "Console output: Switch Traffic stage (Service patched)"],
  ["16", "Browser BEFORE cutover — BLUE badge visible"],
  ["17", "Browser ~2s AFTER cutover — animated to GREEN, no refresh"],
  ["18", "Build with Parameters page with ROLLBACK ticked"],
  ["19", "Browser after manual rollback — BLUE restored"],
  ["20", "kubectl get deploy/pods — both colours Running side-by-side"],
  ["21", "Terminal — in-cluster probe shows clean transition, 0 errors"],
  ["22", "Console of a failed build with auto-rollback firing"],
  ["23", "Two browser windows side-by-side — BLUE and GREEN during a flip"],
];

const appendix = [
  buildTable(
    [1200, CONTENT_W - 1200],
    [
      ["Figure #", "Caption"],
      ...screenshotList,
    ]
  ),
];

const allChildren = [
  ...titlePage,
  ...aim,
  ...setup,
  ...flask,
  ...docker,
  ...k8s,
  ...jenkins,
  ...pipeline,
  ...exec,
  ...verify,
  ...conclusion,
  ...appendix,
];

const doc = new Document({
  creator: "Naveen K M",
  title: "PBL-8 Blue-Green Deployment Lab Report",
  description: "Lab 8 — Blue-Green Deployment with Jenkins, Docker, and Kubernetes",
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, color: "1F3864", font: FONT },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: "2E75B6", font: FONT },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, color: "404040", font: FONT },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "PBL-8 — Blue-Green Deployment with Jenkins, Docker & Kubernetes",
                                   italics: true, size: 18, color: "808080", font: FONT })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Page ", size: 18, color: "808080", font: FONT }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: FONT }),
            new TextRun({ text: " of ", size: 18, color: "808080", font: FONT }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "808080", font: FONT }),
          ],
        })],
      }),
    },
    children: allChildren,
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, 'PBL-8-Lab-Report.docx');
  fs.writeFileSync(out, buf);
  console.log("Wrote " + out);
});
