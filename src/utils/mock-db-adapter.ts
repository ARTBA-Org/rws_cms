/**
 * Mock Database Adapter
 *
 * This file provides a mock database adapter that completely bypasses any database connection
 * attempts during the build process. It's used when NEXT_BUILD_SKIP_DB is set to true.
 */

import type { TypeWithID } from 'payload'
import type { PaginatedDocs, DatabaseAdapter } from 'payload'
import { createDatabaseAdapter } from 'payload/database'

// Create a mock adapter that implements the minimal interface required
export const mockDBAdapter = () => {
  console.log('⚠️ Using mock database adapter - NO DATABASE CONNECTIONS WILL BE MADE')

  return createDatabaseAdapter({
    // Required properties for DatabaseAdapterResult
    defaultIDType: 'text' as const, // Explicitly type as 'text' literal
    init: async ({ payload }) => {
      console.log('Mock database adapter: init() called - doing nothing')
      return {
        payload,
        name: 'mock',
        defaultIDType: 'text',
      }
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
    find: async (): Promise<PaginatedDocs<TypeWithID>> => ({
      docs: [],
      totalDocs: 0,
      page: 1,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    }),
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
    findVersions: async (): Promise<PaginatedDocs<TypeWithID>> => ({
      docs: [],
      totalDocs: 0,
      page: 1,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    }),
    findGlobalVersions: async (): Promise<PaginatedDocs<TypeWithID>> => ({
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
    queryDrafts: async (): Promise<PaginatedDocs<TypeWithID>> => ({
      docs: [],
      totalDocs: 0,
      page: 1,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    }),
    queryVersions: async (): Promise<PaginatedDocs<TypeWithID>> => ({
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
  })
}
