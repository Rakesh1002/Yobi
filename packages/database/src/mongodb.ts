import { MongoClient } from 'mongodb'

// MongoDB connection for non-relational data
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
const options = {}

let client: MongoClient | null = null
let clientPromise: Promise<MongoClient> | null = null

function createConnection(): Promise<MongoClient> {
  if (clientPromise) {
    return clientPromise
  }

  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable to preserve the client
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>
    }

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options)
      globalWithMongo._mongoClientPromise = client.connect()
    }
    clientPromise = globalWithMongo._mongoClientPromise
  } else {
    // In production mode, create a new client for each instance
    client = new MongoClient(uri, options)
    clientPromise = client.connect()
  }
  
  return clientPromise
}

// Only connect when explicitly requested
export const mongoClient = {
  connect: () => createConnection()
}

// Helper function to get database
export async function connectMongoDB() {
  const client = await createConnection()
  return client.db(process.env.MONGODB_DATABASE || 'trading_platform')
} 