/**
 * Mock Database Adapter
 *
 * This file provides a mock database adapter that completely bypasses any database connection
 * attempts during the build process. It's used when NEXT_BUILD_SKIP_DB is set to true.
 */

import type { DatabaseAdapter } from '@payloadcms/db-postgres'

// Create a mock adapter that implements the minimal interface required
export const mockDBAdapter = (): DatabaseAdapter => {
  console.log('⚠️ Using mock database adapter - NO DATABASE CONNECTIONS WILL BE MADE')

  return {
    // Required properties for DatabaseAdapterResult
    defaultIDType: 'text',
    init: async () => {
      console.log('Mock database adapter: init() called - doing nothing')
      return
    },
    // Return a minimal implementation that won't try to connect to a database
    connect: async () => {
      console.log('Mock database adapter: connect() called - doing nothing')
      return { client: null }
    },
    disconnect: async () => {
      console.log('Mock database adapter: disconnect() called - doing nothing')
    },
    // Minimal implementation of required methods
    find: async () => [],
    findOne: async () => null,
    create: async () => ({ id: 'mock-id' }),
    createOrUpdate: async () => ({ id: 'mock-id' }),
    findGlobalVersion: async () => null,
    findGlobal: async () => null,
    updateGlobal: async () => ({}),
    deleteMany: async () => {},
    deleteOne: async () => {},
    update: async () => ({}),
    updateMany: async () => {},
    aggregate: async () => [],
    distinct: async () => [],
    countDocuments: async () => 0,
    createGlobal: async () => ({}),
    createGlobalVersion: async () => ({}),
    findVersions: async () => ({
      docs: [],
      totalDocs: 0,
      page: 1,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    }),
    findGlobalVersions: async () => ({
      docs: [],
      totalDocs: 0,
      page: 1,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    }),
    findVersion: async () => null,
    migrateDown: async () => {},
    migrateUp: async () => {},
    migrationExists: async () => false,
    queryDrafts: async () => ({
      docs: [],
      totalDocs: 0,
      page: 1,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    }),
    queryVersions: async () => ({
      docs: [],
      totalDocs: 0,
      page: 1,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    }),
    beginTransaction: async () => ({ id: 'mock-transaction' }),
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
  }
}
