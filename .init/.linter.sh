#!/bin/bash
cd /home/kavia/workspace/code-generation/iec-61850-semantic-interoperability-validator-8710-8719/frontend_web_app
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

