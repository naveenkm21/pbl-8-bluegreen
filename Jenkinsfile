pipeline {
    agent any

    parameters {
        booleanParam(name: 'ROLLBACK', defaultValue: false,
                     description: 'Tick to roll traffic BACK to blue without building/deploying anything new.')
    }

    environment {
        DOCKERHUB_USER = 'naveenkm21'                 // <-- change to your Docker Hub username
        IMAGE_NAME     = 'cloudops-bluegreen'
        IMAGE_TAG      = "${env.BUILD_NUMBER}"
        FULL_IMAGE     = "${DOCKERHUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}"
        SERVICE_NAME   = 'myapp-service'
        NODE_PORT      = '30008'
    }

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '15'))
    }

    stages {

        stage('Checkout') {
            steps { checkout scm }
        }

        /* ---------- ROLLBACK SHORT-CIRCUIT ---------- */
        stage('Rollback Only') {
            when { expression { return params.ROLLBACK } }
            steps {
                bat '''
                    echo === ROLLBACK: switching service back to BLUE ===
                    kubectl patch service %SERVICE_NAME% -p "{\\"spec\\":{\\"selector\\":{\\"app\\":\\"myapp\\",\\"version\\":\\"blue\\"}}}"
                    kubectl get service %SERVICE_NAME% -o wide
                '''
            }
        }

        /* ---------- NORMAL BLUE -> GREEN PIPELINE ---------- */
        stage('Build Docker Image') {
            when { expression { return !params.ROLLBACK } }
            steps {
                bat 'docker build -t %FULL_IMAGE% .'
            }
        }

        stage('Push to Docker Hub') {
            when { expression { return !params.ROLLBACK } }
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub-creds',
                                                  usernameVariable: 'DH_USER',
                                                  passwordVariable: 'DH_PASS')]) {
                    bat '''
                        echo %DH_PASS% | docker login -u %DH_USER% --password-stdin
                        docker push %FULL_IMAGE%
                        docker logout
                    '''
                }
            }
        }

        stage('Ensure Blue + Service Exist') {
            when { expression { return !params.ROLLBACK } }
            steps {
                // Bootstrap: on the very first run, blue + service may not exist yet.
                powershell '''
                    $img = "${env:FULL_IMAGE}"
                    $build = "${env:BUILD_NUMBER}"
                    (Get-Content k8s/deployment-blue.yaml) `
                        -replace 'IMAGE_PLACEHOLDER', $img `
                        -replace 'BUILD_PLACEHOLDER', $build |
                        Set-Content k8s/_blue.rendered.yaml
                '''
                bat '''
                    kubectl apply -f k8s/_blue.rendered.yaml
                    kubectl apply -f k8s/service.yaml
                    kubectl rollout status deployment/app-blue --timeout=120s
                '''
            }
        }

        stage('Deploy GREEN (new version)') {
            when { expression { return !params.ROLLBACK } }
            steps {
                powershell '''
                    $img = "${env:FULL_IMAGE}"
                    $build = "${env:BUILD_NUMBER}"
                    (Get-Content k8s/deployment-green.yaml) `
                        -replace 'IMAGE_PLACEHOLDER', $img `
                        -replace 'BUILD_PLACEHOLDER', $build |
                        Set-Content k8s/_green.rendered.yaml
                '''
                bat '''
                    kubectl apply -f k8s/_green.rendered.yaml
                    kubectl rollout status deployment/app-green --timeout=180s
                '''
            }
        }

        stage('Smoke Test GREEN (port-forward)') {
            when { expression { return !params.ROLLBACK } }
            steps {
                // Port-forward directly to a green pod and verify /version + /
                powershell '''
                    $ErrorActionPreference = "Stop"
                    $pod = (kubectl get pods -l app=myapp,version=green -o jsonpath="{.items[0].metadata.name}").Trim()
                    Write-Host "Smoke testing pod: $pod"

                    $job = Start-Job -ScriptBlock {
                        param($p)
                        kubectl port-forward pod/$p 18080:5000
                    } -ArgumentList $pod

                    Start-Sleep -Seconds 5
                    try {
                        $v = Invoke-RestMethod -Uri "http://127.0.0.1:18080/version" -TimeoutSec 10
                        Write-Host "Smoke /version response: $($v | ConvertTo-Json -Compress)"
                        if ($v.version -ne "green") { throw "Expected version=green, got $($v.version)" }

                        $home = Invoke-WebRequest -Uri "http://127.0.0.1:18080/" -TimeoutSec 10
                        if ($home.StatusCode -ne 200) { throw "Homepage returned $($home.StatusCode)" }
                        Write-Host "Smoke tests PASSED."
                    } finally {
                        Stop-Job $job -ErrorAction SilentlyContinue
                        Remove-Job $job -ErrorAction SilentlyContinue
                    }
                '''
            }
        }

        stage('Switch Traffic: BLUE -> GREEN') {
            when { expression { return !params.ROLLBACK } }
            steps {
                bat '''
                    echo === Patching service selector to version=green ===
                    kubectl patch service %SERVICE_NAME% -p "{\\"spec\\":{\\"selector\\":{\\"app\\":\\"myapp\\",\\"version\\":\\"green\\"}}}"
                    kubectl get service %SERVICE_NAME% -o wide
                '''
            }
        }

        stage('Post-Switch Verification') {
            when { expression { return !params.ROLLBACK } }
            steps {
                powershell '''
                    Start-Sleep -Seconds 3
                    $r = Invoke-RestMethod -Uri "http://localhost:${env:NODE_PORT}/version" -TimeoutSec 10
                    Write-Host "Public /version response: $($r | ConvertTo-Json -Compress)"
                    if ($r.version -ne "green") { throw "Traffic switch verification FAILED (got $($r.version))" }
                    Write-Host "PUBLIC traffic now served by GREEN. Blue is kept warm for instant rollback."
                '''
            }
        }
    }

    post {
        failure {
            echo "Pipeline failed — auto-rolling traffic back to BLUE (blue deployment is kept warm)."
            bat '''
                kubectl patch service %SERVICE_NAME% -p "{\\"spec\\":{\\"selector\\":{\\"app\\":\\"myapp\\",\\"version\\":\\"blue\\"}}}" || ver>nul
            '''
        }
        success {
            echo "Build #${env.BUILD_NUMBER} live. Visit http://localhost:${env.NODE_PORT}"
        }
    }
}
