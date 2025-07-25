# RAG Knowledge Base Configuration Guide

This document outlines the configuration required for the production-grade RAG (Retrieval-Augmented Generation) knowledge base system in the API Gateway.

## Required Environment Variables

### Core Services
```bash
# API Gateway Configuration
PORT=3002
NODE_ENV=development

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/trading_platform"

# Redis Configuration (for caching)
REDIS_URL="redis://localhost:6379"
```

### AI & Vector Database Services
```bash
# AI Services Configuration
ANTHROPIC_API_KEY="your_anthropic_api_key_for_claude"
OPENAI_API_KEY="your_openai_api_key_for_embeddings"

# Vector Database Configuration
PINECONE_API_KEY="your_pinecone_api_key"
PINECONE_INDEX_NAME="yobi-knowledge"
PINECONE_ENVIRONMENT="us-east1-gcp"
```

### File Storage Configuration
```bash
# AWS S3 Configuration (Required for file storage)
AWS_ACCESS_KEY_ID="your_aws_access_key"
AWS_SECRET_ACCESS_KEY="your_aws_secret_key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="trading-platform-documents"
```

### RAG Processing Configuration
```bash
# Knowledge Processing Configuration
EMBEDDING_MODEL="text-embedding-3-small"
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
MAX_RETRIEVAL_RESULTS=10
SIMILARITY_THRESHOLD=0.7
VECTOR_SEARCH_TOP_K=10
VECTOR_BATCH_SIZE=100
EMBEDDING_BATCH_SIZE=20
EMBEDDING_RATE_LIMIT_DELAY=1000
```

## Pinecone Index Setup

### 1. Create Pinecone Index
```bash
# Index specifications
Name: yobi-knowledge
Dimensions: 1536 (for text-embedding-3-small)
Metric: cosine
Cloud: GCP
Region: us-east1
```

### 2. Index Configuration
```python
# Example Pinecone index creation (if needed)
import pinecone

pinecone.init(
    api_key="your_pinecone_api_key",
    environment="us-east1-gcp"
)

if "yobi-knowledge" not in pinecone.list_indexes():
    pinecone.create_index(
        name="yobi-knowledge",
        dimension=1536,
        metric="cosine",
        shards=1
    )
```

## API Endpoints

### Document Upload & Processing
```bash
# Upload document with RAG processing
POST /api/knowledge/documents/upload
Content-Type: multipart/form-data

# Body:
document: <PDF or TXT file>
title: "Document Title"
category: "RESEARCH" | "CFA" | "EDUCATION" | "SEC_FILING"
source: "USER_UPLOAD" (optional)
```

### Knowledge Search
```bash
# Vector similarity search
POST /api/knowledge/search
Content-Type: application/json

{
  "query": "financial analysis DCF valuation",
  "limit": 10,
  "threshold": 0.7
}
```

### RAG-Enhanced Analysis
```bash
# Get enhanced analysis with knowledge base
POST /api/knowledge/analysis/enhanced
Content-Type: application/json

{
  "symbol": "AAPL",
  "analysisType": "FUNDAMENTAL",
  "includeKnowledge": true,
  "timeHorizon": "MEDIUM_TERM"
}
```

### Document Management
```bash
# Get document RAG processing status
GET /api/knowledge/documents/{id}/rag-status

# Reprocess document through RAG pipeline
POST /api/knowledge/documents/{id}/reprocess

# Download document
GET /api/knowledge/documents/{id}/download

# View document inline
GET /api/knowledge/documents/{id}/view

# Delete document and vectors
DELETE /api/knowledge/documents/{id}
```

### Health & Status
```bash
# Knowledge base health check
GET /api/knowledge/health

# Returns:
{
  "status": "OK",
  "features": {
    "documentUpload": "available",
    "fileStorage": "s3_available",
    "semanticSearch": "available",
    "vectorDatabase": "available",
    "embeddings": "available",
    "ragCapable": true
  },
  "vectorDatabase": {
    "connected": true,
    "indexExists": true
  }
}
```

## RAG Processing Pipeline

### 1. Document Upload Flow
```
File Upload → S3 Storage → Text Extraction → Chunking → 
Concept Extraction → Embedding Generation → Vector Storage → 
Database Update → Response
```

### 2. Vector Search Flow
```
Query → Embedding Generation → Pinecone Search → 
Result Filtering → Response Formatting → Return Results
```

### 3. Enhanced Analysis Flow
```
Analysis Request → Vector Search → Knowledge Retrieval → 
Claude Analysis → RAG-Enhanced Response
```

## Data Flow Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   File Upload   │───▶│   S3 Storage │───▶│  Text Extraction│
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                      │
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Vector Storage │◀───│  Embeddings  │◀───│    Chunking     │
│   (Pinecone)    │    │   (OpenAI)   │    │   & Concepts    │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Knowledge Search│───▶│ RAG Analysis │───▶│Enhanced Insights│
└─────────────────┘    └──────────────┘    └─────────────────┘
```

## Monitoring & Debugging

### Key Metrics to Monitor
- Document upload success rate
- RAG processing completion rate
- Embedding generation latency
- Vector storage success rate
- Search query response time
- Vector search relevance scores

### Debug Endpoints
```bash
# Check document processing status
GET /api/knowledge/documents/{id}/rag-status

# View processing logs in application logs
# Search for: "RAG processing", "embedding generation", "vector storage"
```

### Common Issues & Solutions

1. **RAG Processing Fails**
   - Check OpenAI API key and quota
   - Verify Pinecone connection and index exists
   - Check document text extraction

2. **Low Search Relevance**
   - Adjust similarity threshold (0.6-0.8)
   - Review embedding model consistency
   - Check query formulation

3. **S3 Upload Issues**
   - Verify AWS credentials and permissions
   - Check S3 bucket exists and is accessible
   - Validate file size limits

## Performance Optimization

### Recommended Settings
```bash
# Production optimizations
EMBEDDING_BATCH_SIZE=50        # Increase for better throughput
VECTOR_BATCH_SIZE=200          # Larger batches for Pinecone
EMBEDDING_RATE_LIMIT_DELAY=500 # Reduce for faster processing
MAX_CONCURRENT_PROCESSING=10   # Increase based on resources
```

### Scaling Considerations
- Use Redis for caching frequent queries
- Implement queue system for large document processing
- Consider batch processing for multiple documents
- Monitor API rate limits for OpenAI and Pinecone

## Security Best Practices

1. **API Keys**: Store in environment variables, never in code
2. **S3 Permissions**: Use least-privilege access policies
3. **Rate Limiting**: Implement appropriate limits for uploads
4. **Input Validation**: Sanitize file uploads and queries
5. **Logging**: Monitor for unusual activity patterns

## Testing

### Health Check Commands
```bash
# Test full RAG pipeline
curl -X GET "http://localhost:3002/api/knowledge/health"

# Test document upload
curl -X POST "http://localhost:3002/api/knowledge/documents/upload" \
  -F "document=@test.pdf" \
  -F "title=Test Document" \
  -F "category=RESEARCH"

# Test vector search
curl -X POST "http://localhost:3002/api/knowledge/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"financial analysis","limit":5}'
```

This configuration enables a production-grade RAG system with proper error handling, monitoring, and scalability considerations. 