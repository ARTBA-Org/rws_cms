FROM public.ecr.aws/lambda/python:3.13

# Install system dependencies for PyMuPDF
RUN dnf update -y && \
    dnf install -y gcc-c++ && \
    dnf clean all

# Copy requirements and install Python dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ${LAMBDA_TASK_ROOT}/app/

# Copy Lambda Web Adapter
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter /opt/extensions/

# Set environment variables for Lambda Web Adapter
ENV AWS_LWA_ENABLE_COMPRESSION=true
ENV AWS_LWA_PORT=8000

# Create the bootstrap script that Lambda Web Adapter will execute
RUN echo '#!/bin/bash' > ${LAMBDA_TASK_ROOT}/bootstrap && \
    echo 'exec uvicorn app.main:app --host 0.0.0.0 --port 8000' >> ${LAMBDA_TASK_ROOT}/bootstrap && \
    chmod +x ${LAMBDA_TASK_ROOT}/bootstrap

# Create a proper handler function that will never be called
RUN echo 'def lambda_handler(event, context):' > ${LAMBDA_TASK_ROOT}/lambda_function.py && \
    echo '    return {"statusCode": 200, "body": "Lambda Web Adapter should handle this"}' >> ${LAMBDA_TASK_ROOT}/lambda_function.py

# Set the handler - Lambda Web Adapter will intercept and start the bootstrap script
CMD ["lambda_function.lambda_handler"]