// Git service for Supru
// Provides basic git operations for agents to work with repositories
const { exec } = require('child_process');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

class GitService {
  constructor() {
    this.repos = new Map(); // repoPath => { status, lastCommit }
  }

  /**
   * Initialize a git repository in the given directory
   * @param {string} repoPath - Path to the directory to initialize as git repo
   * @returns {Promise<Object>} - Result of the operation
   */
  async init(repoPath) {
    try {
      const { stdout, stderr } = await execAsync('git init', { cwd: repoPath });
      return { success: true, stdout, stderr };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Check if a directory is a git repository
   * @param {string} repoPath - Path to check
   * @returns {Promise<boolean>} - True if it's a git repo
   */
  async isGitRepo(repoPath) {
    try {
      const { stdout, stderr } = await execAsync('git rev-parse --is-inside-work-tree', { cwd: repoPath });
      return stdout.trim() === 'true';
    } catch (err) {
      return false;
    }
  }

  /**
   * Get the current git status
   * @param {string} repoPath - Path to the git repository
   * @returns {Promise<Object>} - Git status information
   */
  async status(repoPath) {
    try {
      const { stdout, stderr } = await execAsync('git status --porcelain', { cwd: repoPath });
      const changes = stdout.trim().split('\n').filter(line => line.length > 0);
      return {
        success: true,
        stdout,
        stderr,
        changes: changes,
        isClean: changes.length === 0
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Add files to git staging area
   * @param {string} repoPath - Path to the git repository
   * @param {string|string[]} files - Files to add (use '.' for all)
   * @returns {Promise<Object>} - Result of the operation
   */
  async add(repoPath, files) {
    try {
      const filesArg = Array.isArray(files) ? files.join(' ') : files;
      const { stdout, stderr } = await execAsync(`git add ${filesArg}`, { cwd: repoPath });
      return { success: true, stdout, stderr };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Commit staged changes
   * @param {string} repoPath - Path to the git repository
   * @param {string} message - Commit message
   * @returns {Promise<Object>} - Result of the operation
   */
  async commit(repoPath, message) {
    try {
      const { stdout, stderr } = await execAsync(`git commit -m "${message}"`, { cwd: repoPath });
      return { success: true, stdout, stderr };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get the commit history
   * @param {string} repoPath - Path to the git repository
   * @param {number} limit - Number of commits to return (default: 10)
   * @returns {Promise<Object>} - Commit history
   */
  async log(repoPath, limit = 10) {
    try {
      const { stdout, stderr } = await execAsync(`git log --oneline -${limit}`, { cwd: repoPath });
      return { success: true, stdout, stderr };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Create a new branch
   * @param {string} repoPath - Path to the git repository
   * @param {string} branchName - Name of the new branch
   * @returns {Promise<Object>} - Result of the operation
   */
  async branch(repoPath, branchName) {
    try {
      const { stdout, stderr } = await execAsync(`git branch ${branchName}`, { cwd: repoPath });
      return { success: true, stdout, stderr };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Switch to a branch
   * @param {string} repoPath - Path to the git repository
   * @param {string} branchName - Name of the branch to switch to
   * @returns {Promise<Object>} - Result of the operation
   */
  async checkout(repoPath, branchName) {
    try {
      const { stdout, stderr } = await execAsync(`git checkout ${branchName}`, { cwd: repoPath });
      return { success: true, stdout, stderr };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get the current branch
   * @param {string} repoPath - Path to the git repository
   * @returns {Promise<Object>} - Current branch information
   */
  async currentBranch(repoPath) {
    try {
      const { stdout, stderr } = await execAsync('git branch --show-current', { cwd: repoPath });
      return { success: true, branch: stdout.trim(), stderr };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Pull from remote
   * @param {string} repoPath - Path to the git repository
   * @param {string} remote - Remote name (default: 'origin')
   * @param {string} branch - Branch name (default: current branch)
   * @returns {Promise<Object>} - Result of the operation
   */
  async pull(repoPath, remote = 'origin', branch) {
    try {
      let args = `git pull ${remote}`;
      if (branch) {
        args += ` ${branch}`;
      }
      const { stdout, stderr } = await execAsync(args, { cwd: repoPath });
      return { success: true, stdout, stderr };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Push to remote
   * @param {string} repoPath - Path to the git repository
   * @param {string} remote - Remote name (default: 'origin')
   * @param {string} branch - Branch name (default: current branch)
   * @returns {Promise<Object>} - Result of the operation
   */
  async push(repoPath, remote = 'origin', branch) {
    try {
      let args = `git push ${remote}`;
      if (branch) {
        args += ` ${branch}`;
      }
      const { stdout, stderr } = await execAsync(args, { cwd: repoPath });
      return { success: true, stdout, stderr };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get the diff of staged changes
   * @param {string} repoPath - Path to the git repository
   * @returns {Promise<Object>} - Diff of staged changes
   */
  async diffStaged(repoPath) {
    try {
      const { stdout, stderr } = await execAsync('git diff --staged', { cwd: repoPath });
      return { success: true, stdout, stderr };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get the diff of unstaged changes
   * @param {string} repoPath - Path to the git repository
   * @returns {Promise<Object>} - Diff of unstaged changes
   */
  async diff(repoPath) {
    try {
      const { stdout, stderr } = await execAsync('git diff', { cwd: repoPath });
      return { success: true, stdout, stderr };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = { GitService: new GitService() };