pipeline {
    agent any

    parameters {
        string(name: 'DEPLOY_HOST', defaultValue: env.DEPLOY_HOST ?: '', description: 'Public IP/DNS of the EC2 deploy target - falls back to the Global property of the same name if set')
        string(name: 'IMAGE_NAME', defaultValue: env.IMAGE_NAME ?: 'yourdockerhubuser/lab-dom07-server-details', description: 'Docker Hub repo to push the image to - falls back to the Global property of the same name if set')
    }

    environment {
        DEPLOY_HOST    = "${params.DEPLOY_HOST}"
        IMAGE_NAME     = "${params.IMAGE_NAME}"
        IMAGE_TAG      = "${env.BUILD_NUMBER}"
        DEPLOY_USER    = 'ec2-user'
        APP_PORT       = '3000'
        CONTAINER_NAME = 'server-details-app'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install & Build') {
            steps {
                sh 'npm install --no-audit --no-fund'
            }
        }

        stage('Test') {
            steps {
                sh '''
                    mkdir -p test-results
                    node --test --test-reporter=junit --test-reporter-destination=test-results/junit.xml
                '''
            }
            post {
                always {
                    junit 'test-results/junit.xml'
                }
            }
        }

        stage('Docker Build') {
            steps {
                sh 'docker build -t "$IMAGE_NAME:$IMAGE_TAG" -t "$IMAGE_NAME:latest" .'
            }
        }

        stage('Push Image') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'registry_creds', usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
                    sh '''
                        echo "$REG_PASS" | docker login -u "$REG_USER" --password-stdin
                        docker push "$IMAGE_NAME:$IMAGE_TAG"
                        docker push "$IMAGE_NAME:latest"
                        docker logout
                    '''
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    if (!env.DEPLOY_HOST?.trim()) {
                        error 'DEPLOY_HOST parameter is required - the public IP/DNS of the EC2 deploy target'
                    }
                }
                sshagent(credentials: ['ec2_ssh']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no "$DEPLOY_USER@$DEPLOY_HOST" "
                            docker pull $IMAGE_NAME:$IMAGE_TAG &&
                            (docker stop $CONTAINER_NAME || true) &&
                            (docker rm $CONTAINER_NAME || true) &&
                            docker run -d --name $CONTAINER_NAME --restart unless-stopped \
                                -p $APP_PORT:3000 \
                                $IMAGE_NAME:$IMAGE_TAG
                        "
                    '''
                }
            }
        }

        stage('Verify') {
            steps {
                sh '''
                    sleep 5
                    curl -sf "http://$DEPLOY_HOST:$APP_PORT/api/server-info"
                '''
            }
        }

        stage('Cleanup') {
            steps {
                // Prune anything older than a day on the deploy target, so a
                // rollback to yesterday's tag is still possible if needed.
                sshagent(credentials: ['ec2_ssh']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no "$DEPLOY_USER@$DEPLOY_HOST" \
                            "docker image prune -af --filter until=24h && docker container prune -f --filter until=24h"
                    '''
                }
                sh 'docker image prune -f || true'
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded - app live at http://${env.DEPLOY_HOST}:${env.APP_PORT}/"
        }
        failure {
            echo 'Pipeline failed - check the stage logs above.'
        }
        always {
            sh 'docker logout || true'
        }
    }
}
