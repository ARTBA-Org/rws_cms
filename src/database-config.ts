// Database configuration to handle timeouts
export const databaseConfig = {
  // Increase statement timeout to handle long-running operations
  statement_timeout: '300000', // 5 minutes
  // Increase lock timeout
  lock_timeout: '60000', // 1 minute
  // Increase idle timeout
  idle_in_transaction_session_timeout: '300000', // 5 minutes
}
