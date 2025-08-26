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
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter ${LAMBDA_RUNTIME_DIR}/extensions/

# Set environment variables for Lambda Web Adapter
ENV AWS_LWA_ENABLE_COMPRESSION=true
ENV AWS_LWA_PORT=8000

# Set the CMD to start uvicorn directly
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]