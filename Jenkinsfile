pipeline {
    agent any

    parameters {
        booleanParam(name: 'ROLLBACK', defaultValue: false,
                     description: 'Tick to roll traffic BACK to blue without building/deploying anything new.')
    }

    environment {
        DOCKERHUB_USER = 'naveenkm21'
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
                sh '''
                    echo "=== ROLLBACK: switching service back to BLUE ==="
                    kubectl patch service ${SERVICE_NAME} -p '{"spec":{"selector":{"app":"myapp","version":"blue"}}}'
                    kubectl get service ${SERVICE_NAME} -o wide
                '''
            }
        }

        /* ---------- NORMAL BLUE -> GREEN PIPELINE ---------- */
        stage('Build Docker Image') {
            when { expression { return !params.ROLLBACK } }
            steps {
                sh 'docker build -t ${FULL_IMAGE} .'
            }
        }

        stage('Push to Docker Hub') {
            when { expression { return !params.ROLLBACK } }
            steps {
                withCredentials([usernamePassword(credentialsId: 'docker-creds',
                                                  usernameVariable: 'DH_USER',
                                                  passwordVariable: 'DH_PASS')]) {
                    sh '''
                        echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
                        docker push ${FULL_IMAGE}
                        docker logout
                    '''
                }
            }
        }

        stage('Ensure Blue + Service Exist') {
            when { expression { return !params.ROLLBACK } }
            steps {
                sh '''
                    sed -e "s|IMAGE_PLACEHOLDER|${FULL_IMAGE}|g" \
                        -e "s|BUILD_PLACEHOLDER|${BUILD_NUMBER}|g" \
                        k8s/deployment-blue.yaml | kubectl apply -f -
                    kubectl apply -f k8s/service.yaml
                    kubectl rollout status deployment/app-blue --timeout=120s
                '''
            }
        }

        stage('Deploy GREEN (new version)') {
            when { expression { return !params.ROLLBACK } }
            steps {
                sh '''
                    sed -e "s|IMAGE_PLACEHOLDER|${FULL_IMAGE}|g" \
                        -e "s|BUILD_PLACEHOLDER|${BUILD_NUMBER}|g" \
                        k8s/deployment-green.yaml | kubectl apply -f -
                    kubectl rollout status deployment/app-green --timeout=180s
                '''
            }
        }

        stage('Smoke Test GREEN') {
            when { expression { return !params.ROLLBACK } }
            steps {
                // Run curl from INSIDE the cluster against a green pod IP — no port-forward needed.
                sh '''
                    set -e
                    GREEN_IP=$(kubectl get pods -l app=myapp,version=green \
                                -o jsonpath='{.items[0].status.podIP}')
                    echo "Smoke testing green pod IP: $GREEN_IP"

                    RESULT=$(kubectl run smoke-${BUILD_NUMBER} --rm -i --restart=Never \
                                --image=curlimages/curl:latest --quiet -- \
                                curl -sf http://${GREEN_IP}:5000/version)
                    echo "Response: $RESULT"
                    echo "$RESULT" | grep -q '"version":"green"' || { echo "Smoke FAILED"; exit 1; }
                    echo "Smoke test PASSED"
                '''
            }
        }

        stage('Switch Traffic: BLUE -> GREEN') {
            when { expression { return !params.ROLLBACK } }
            steps {
                sh '''
                    echo "=== Patching service selector to version=green ==="
                    kubectl patch service ${SERVICE_NAME} \
                        -p '{"spec":{"selector":{"app":"myapp","version":"green"}}}'
                    kubectl get service ${SERVICE_NAME} -o wide
                '''
            }
        }

        stage('Post-Switch Verification') {
            when { expression { return !params.ROLLBACK } }
            steps {
                sh '''
                    sleep 3
                    RESULT=$(kubectl run verify-${BUILD_NUMBER} --rm -i --restart=Never \
                                --image=curlimages/curl:latest --quiet -- \
                                curl -sf http://${SERVICE_NAME}.default.svc.cluster.local/version)
                    echo "Public /version response: $RESULT"
                    echo "$RESULT" | grep -q '"version":"green"' || { echo "Verify FAILED"; exit 1; }
                    echo "PUBLIC traffic now served by GREEN. Blue is kept warm for instant rollback."
                '''
            }
        }
    }

    post {
        failure {
            echo "Pipeline failed — auto-rolling traffic back to BLUE."
            sh '''
                kubectl patch service ${SERVICE_NAME} \
                    -p '{"spec":{"selector":{"app":"myapp","version":"blue"}}}' || true
            '''
        }
        success {
            echo "Build #${env.BUILD_NUMBER} live. Visit http://localhost:${env.NODE_PORT}"
        }
    }
}
