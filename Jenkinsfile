pipeline {
    agent any

    parameters {
        choice(name: 'TARGET_COLOR', choices: ['green', 'blue'], description: 'Color to deploy the new version to (the INACTIVE one)')
        string(name: 'IMAGE_TAG', defaultValue: 'v2', description: 'New image tag to deploy')
    }

    environment {
        IMAGE_NAME = "pbl8-app"
        REGISTRY   = "docker.io/naveenkm21"
        FULL_IMAGE = "${REGISTRY}/${IMAGE_NAME}:${params.IMAGE_TAG}"
    }

    options { timestamps() }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Build & Push Image') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub-creds',
                                                  usernameVariable: 'DH_USER',
                                                  passwordVariable: 'DH_PASS')]) {
                    sh '''
                        docker build -t ${FULL_IMAGE} .
                        echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
                        docker push ${FULL_IMAGE}
                    '''
                }
            }
        }

        stage('Deploy to Inactive Color') {
            steps {
                withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG')]) {
                    sh '''
                        MANIFEST=k8s/deployment-${TARGET_COLOR}.yaml
                        sed "s|REPLACE_ME_IMAGE|${FULL_IMAGE}|g" $MANIFEST | kubectl apply -f -
                        kubectl apply -f k8s/service.yaml
                        kubectl apply -f k8s/service-preview.yaml
                        kubectl rollout status deployment/pbl8-app-${TARGET_COLOR} --timeout=180s
                    '''
                }
            }
        }

        stage('Smoke Test (Preview)') {
            steps {
                sh '''
                    # Point preview service at the freshly deployed color
                    kubectl patch svc pbl8-app-preview -p \
                        "{\\"spec\\":{\\"selector\\":{\\"app\\":\\"pbl8-app\\",\\"color\\":\\"${TARGET_COLOR}\\"}}}"

                    SVC_IP=$(kubectl get svc pbl8-app-preview -o jsonpath='{.spec.clusterIP}')
                    kubectl run smoke-${BUILD_NUMBER} --rm -i --restart=Never --image=curlimages/curl -- \
                        curl -sf http://${SVC_IP}/health
                '''
            }
        }

        stage('Manual Approval') {
            steps {
                input message: "Smoke test passed on ${params.TARGET_COLOR}. Cut over public traffic?",
                      ok: "Switch traffic"
            }
        }

        stage('Cut Over Traffic') {
            steps {
                sh 'bash scripts/switch-traffic.sh ${TARGET_COLOR}'
            }
        }

        stage('Post-Cutover Verification') {
            steps {
                sh '''
                    SVC_IP=$(kubectl get svc pbl8-app-svc -o jsonpath='{.spec.clusterIP}')
                    for i in 1 2 3 4 5; do
                        kubectl run verify-${BUILD_NUMBER}-${i} --rm -i --restart=Never --image=curlimages/curl -- \
                            curl -sf http://${SVC_IP}/
                    done
                '''
            }
        }
    }

    post {
        failure {
            echo "Deployment failed — running automatic rollback."
            sh 'bash scripts/rollback.sh || true'
        }
        success { echo "Cutover to ${params.TARGET_COLOR} completed." }
    }
}
