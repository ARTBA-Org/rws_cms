import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { pdfProcessor } from './function/pdfProcessor/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  pdfProcessor, // Add the PDF processor function
});

// Grant the function permissions if needed
// For example, to access S3:
// backend.pdfProcessor.resources.lambda.addToRolePolicy(...);